import {
  entityKey,
  syncableTables,
  type LocalDevice,
  type OutboxOperation,
  type RemoteRecord,
  type SyncRemoteGateway,
  type SyncStatus,
} from './types'
import { LocalSyncStore } from '../../infrastructure/storage/localSyncStore'

type SyncEngineDependencies = {
  isOnline?: () => boolean
  now?: () => Date
  pageSize?: number
}

type SyncRequest = {
  userId: string
  device: LocalDevice
  force?: boolean
}

const initialStatus: SyncStatus = {
  state: 'SYNCED',
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  errorMessage: null,
}

function intendedFieldsMatch(remote: RemoteRecord, operation: OutboxOperation) {
  return Object.entries(operation.payload).every(([field, value]) => {
    if (field === 'version' || field === 'updated_at') return true
    return JSON.stringify(remote[field]) === JSON.stringify(value)
  })
}

export class SyncEngine {
  private readonly store: LocalSyncStore
  private readonly remote: SyncRemoteGateway
  private readonly isOnline: () => boolean
  private readonly now: () => Date
  private readonly pageSize: number
  private status: SyncStatus = initialStatus
  private running: Promise<SyncStatus> | null = null
  private readonly listeners = new Set<(status: SyncStatus) => void>()

  constructor(
    store: LocalSyncStore,
    remote: SyncRemoteGateway,
    dependencies: SyncEngineDependencies = {},
  ) {
    this.store = store
    this.remote = remote
    this.isOnline = dependencies.isOnline ?? (() => navigator.onLine)
    this.now = dependencies.now ?? (() => new Date())
    this.pageSize = dependencies.pageSize ?? 100
  }

  getStatus() {
    return this.status
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  sync(request: SyncRequest): Promise<SyncStatus> {
    if (this.running) {
      return this.running.then(() => this.sync(request))
    }
    this.running = this.performSync(request).finally(() => {
      this.running = null
    })
    return this.running
  }

  private async performSync(request: SyncRequest) {
    if (!this.isOnline()) {
      return this.refreshStatus(request.userId, 'OFFLINE', null)
    }

    await this.refreshStatus(request.userId, 'SYNCING', null)
    let retryMessage: string | null = null
    const blockedEntities = new Set<string>()

    try {
      await this.remote.prepare(request.userId, request.device)
      const operations = await this.store.pendingOperations(request.userId, request.force)
      for (const operation of operations) {
        if (blockedEntities.has(operation.entityKey)) continue
        const result = await this.remote.push(operation)
        if (result.outcome === 'APPLIED') {
          await this.store.completeOperation(operation, result.record)
        } else if (result.outcome === 'CONFLICT') {
          await this.store.createConflict(operation, result.remoteRecord)
          blockedEntities.add(operation.entityKey)
        } else {
          await this.store.retryOperation(operation, result.message)
          retryMessage ??= result.message
          blockedEntities.add(operation.entityKey)
        }
      }

      for (const table of syncableTables) {
        await this.pullTable(request.userId, table)
      }

      const counts = await this.store.counts(request.userId)
      if (counts.conflictCount > 0) {
        return this.setStatus({
          state: 'CONFLICT',
          ...counts,
          lastSyncedAt: this.now().toISOString(),
          errorMessage: null,
        })
      }
      if (retryMessage) {
        return this.setStatus({
          state: 'ERROR',
          ...counts,
          lastSyncedAt: this.status.lastSyncedAt,
          errorMessage: retryMessage,
        })
      }
      return this.setStatus({
        state: 'SYNCED',
        ...counts,
        lastSyncedAt: this.now().toISOString(),
        errorMessage: null,
      })
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : 'Synkronointi epäonnistui.'
      return this.refreshStatus(request.userId, 'ERROR', message)
    }
  }

  private async pullTable(userId: string, table: (typeof syncableTables)[number]) {
    let cursor = await this.store.getCursor(userId, table)
    let hasMore = true
    while (hasMore) {
      const page = await this.remote.pull(userId, table, cursor, this.pageSize)
      for (const remoteRecord of page.records) {
        const value = entityKey(table, remoteRecord.id)
        if (await this.store.openConflict(userId, value)) continue
        const operations = await this.store.operationsForEntity(userId, value)
        const firstPending = operations.find((operation) => operation.state === 'PENDING')

        if (!firstPending) {
          await this.store.putRemoteRecord(table, remoteRecord)
        } else if (
          firstPending.kind === 'INSERT' &&
          intendedFieldsMatch(remoteRecord, firstPending)
        ) {
          await this.store.completeOperation(firstPending, remoteRecord)
        } else if (
          firstPending.baseVersion !== null &&
          remoteRecord.version > firstPending.baseVersion
        ) {
          await this.store.createConflict(firstPending, remoteRecord)
        }
      }

      const last = page.records.at(-1)
      if (last) {
        cursor = { updatedAt: last.updated_at, id: last.id }
        await this.store.setCursor(userId, table, cursor)
      }
      hasMore = page.hasMore && page.records.length > 0
    }
  }

  private async refreshStatus(
    userId: string,
    state: SyncStatus['state'],
    errorMessage: string | null,
  ) {
    const counts = await this.store.counts(userId)
    return this.setStatus({
      state,
      ...counts,
      lastSyncedAt: this.status.lastSyncedAt,
      errorMessage,
    })
  }

  private setStatus(status: SyncStatus) {
    this.status = status
    for (const listener of this.listeners) listener(status)
    return status
  }
}
