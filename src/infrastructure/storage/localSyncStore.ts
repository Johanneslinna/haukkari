import {
  entityKey,
  metadataKey,
  recordKey,
  type ConflictResolution,
  type LocalDevice,
  type LocalRecord,
  type LocalSyncConflict,
  type OutboxOperation,
  type RemoteRecord,
  type SyncCursor,
  type SyncMetadata,
  type SyncableTable,
} from '../../domain/sync/types'
import { TreenikompassiDatabase } from './localDatabase'

type StoreDependencies = {
  now?: () => Date
  uuid?: () => string
}

export class LocalSyncStore {
  private readonly database: TreenikompassiDatabase
  private readonly now: () => Date
  private readonly uuid: () => string

  constructor(database: TreenikompassiDatabase, dependencies: StoreDependencies = {}) {
    this.database = database
    this.now = dependencies.now ?? (() => new Date())
    this.uuid = dependencies.uuid ?? (() => crypto.randomUUID())
  }

  async ensureDevice(userId: string, deviceKey: string, displayName: string) {
    const existing = await this.database.devices
      .where('[userId+deviceKey]')
      .equals([userId, deviceKey])
      .first()
    const device: LocalDevice = existing
      ? { ...existing, displayName, lastSeenAt: this.now().toISOString() }
      : {
          id: this.uuid(),
          userId,
          deviceKey,
          displayName,
          lastSeenAt: this.now().toISOString(),
        }
    await this.database.devices.put(device)
    return device
  }

  async pendingOperations(userId: string, force = false) {
    const now = this.now().toISOString()
    const operations = await this.database.outbox.where('userId').equals(userId).toArray()
    return operations
      .filter(
        (operation) =>
          operation.state === 'PENDING' && (force || operation.nextAttemptAt <= now),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async operationsForEntity(userId: string, value: string) {
    const operations = await this.database.outbox
      .where('[userId+entityKey]')
      .equals([userId, value])
      .toArray()
    return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async completeOperation(operation: OutboxOperation, remoteRecord: RemoteRecord) {
    await this.database.transaction(
      'rw',
      [this.database.outbox, this.database.records],
      async () => {
        await this.database.outbox.delete(operation.operationId)
        const remaining = await this.operationsForEntity(
          operation.userId,
          operation.entityKey,
        )
        if (remaining.length === 0) {
          await this.database.records.put(
            this.localRecord(operation.table, remoteRecord, 'SYNCED'),
          )
        }
      },
    )
  }

  async retryOperation(operation: OutboxOperation, message: string) {
    const attempts = operation.attempts + 1
    const delaySeconds = Math.min(300, 2 ** Math.min(attempts, 8))
    const nextAttemptAt = new Date(
      this.now().getTime() + delaySeconds * 1000,
    ).toISOString()
    await this.database.outbox.update(operation.operationId, {
      attempts,
      nextAttemptAt,
      lastError: message,
    })
  }

  async createConflict(operation: OutboxOperation, remoteRecord: RemoteRecord) {
    const open = await this.openConflict(operation.userId, operation.entityKey)
    if (open) return open
    const local = await this.database.records.get(
      recordKey(operation.userId, operation.table, operation.entityId),
    )
    const conflict: LocalSyncConflict = {
      id: this.uuid(),
      userId: operation.userId,
      entityKey: operation.entityKey,
      entityId: operation.entityId,
      table: operation.table,
      operationId: operation.operationId,
      localVersion: local?.version ?? operation.localVersion,
      remoteVersion: remoteRecord.version,
      localSnapshot: local?.data ?? operation.payload,
      remoteSnapshot: remoteRecord,
      status: 'OPEN',
      resolution: null,
      createdAt: this.now().toISOString(),
      resolvedAt: null,
    }
    await this.database.transaction(
      'rw',
      [this.database.conflicts, this.database.outbox, this.database.records],
      async () => {
        await this.database.conflicts.add(conflict)
        await this.database.outbox.update(operation.operationId, { state: 'CONFLICT' })
        if (local)
          await this.database.records.update(local.key, { syncState: 'CONFLICT' })
      },
    )
    return conflict
  }

  async openConflict(userId: string, value: string) {
    return this.database.conflicts
      .where('[userId+entityKey]')
      .equals([userId, value])
      .filter((conflict) => conflict.status === 'OPEN')
      .first()
  }

  async putRemoteRecord(table: SyncableTable, record: RemoteRecord) {
    await this.database.records.put(this.localRecord(table, record, 'SYNCED'))
  }

  async getCursor(userId: string, table: SyncableTable) {
    return (await this.database.metadata.get(metadataKey(userId, table)))?.cursor ?? null
  }

  async setCursor(userId: string, table: SyncableTable, cursor: SyncCursor) {
    const metadata: SyncMetadata = {
      key: metadataKey(userId, table),
      userId,
      table,
      cursor,
    }
    await this.database.metadata.put(metadata)
  }

  async counts(userId: string) {
    const [pendingCount, conflictCount] = await Promise.all([
      this.database.outbox
        .where('userId')
        .equals(userId)
        .filter((operation) => operation.state === 'PENDING')
        .count(),
      this.database.conflicts
        .where('userId')
        .equals(userId)
        .filter((conflict) => conflict.status === 'OPEN')
        .count(),
    ])
    return { pendingCount, conflictCount }
  }

  async openConflicts(userId: string) {
    return this.database.conflicts
      .where('userId')
      .equals(userId)
      .filter((conflict) => conflict.status === 'OPEN')
      .sortBy('createdAt')
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution) {
    const conflict = await this.database.conflicts.get(conflictId)
    if (!conflict || conflict.status !== 'OPEN') {
      throw new Error('Avointa synkronointiristiriitaa ei löytynyt.')
    }

    const timestamp = this.now().toISOString()
    await this.database.transaction(
      'rw',
      [this.database.conflicts, this.database.outbox, this.database.records],
      async () => {
        const operations = await this.operationsForEntity(
          conflict.userId,
          conflict.entityKey,
        )
        await this.database.outbox.bulkDelete(
          operations.map((operation) => operation.operationId),
        )

        if (resolution.choice === 'REMOTE') {
          await this.database.records.put(
            this.localRecord(conflict.table, conflict.remoteSnapshot, 'SYNCED'),
          )
        } else {
          const selected =
            resolution.choice === 'LOCAL'
              ? conflict.localSnapshot
              : { ...conflict.remoteSnapshot, ...resolution.data }
          const localData: RemoteRecord = {
            ...selected,
            id: conflict.remoteSnapshot.id,
            user_id: conflict.remoteSnapshot.user_id,
            created_at: conflict.remoteSnapshot.created_at,
            updated_at: timestamp,
            version: conflict.remoteVersion + 1,
            deleted_at: selected.deleted_at ?? null,
          }
          const payload: RemoteRecord = {
            ...localData,
            version: conflict.remoteVersion,
          }
          const operation: OutboxOperation = {
            operationId: this.uuid(),
            userId: conflict.userId,
            deviceId: operations[0]?.deviceId ?? this.uuid(),
            entityKey: conflict.entityKey,
            entityId: conflict.entityId,
            table: conflict.table,
            kind: localData.deleted_at ? 'DELETE' : 'UPDATE',
            baseVersion: conflict.remoteVersion,
            localVersion: localData.version,
            payload,
            state: 'PENDING',
            attempts: 0,
            nextAttemptAt: timestamp,
            lastError: null,
            createdAt: timestamp,
          }
          await this.database.records.put(
            this.localRecord(conflict.table, localData, 'PENDING'),
          )
          await this.database.outbox.add(operation)
        }

        await this.database.conflicts.update(conflict.id, {
          status: 'RESOLVED',
          resolution: resolution.choice === 'MERGED' ? 'MERGED' : resolution.choice,
          resolvedAt: timestamp,
        })
      },
    )
  }

  private localRecord(
    table: SyncableTable,
    data: RemoteRecord,
    syncState: LocalRecord['syncState'],
  ): LocalRecord {
    return {
      key: recordKey(data.user_id, table, data.id),
      entityKey: entityKey(table, data.id),
      id: data.id,
      userId: data.user_id,
      table,
      data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deletedAt: data.deleted_at,
      version: data.version,
      syncState,
    }
  }
}
