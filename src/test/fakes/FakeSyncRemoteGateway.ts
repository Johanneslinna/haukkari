import type {
  LocalDevice,
  OutboxOperation,
  PullPage,
  PushResult,
  RemoteRecord,
  SyncCursor,
  SyncRemoteGateway,
  SyncableTable,
} from '../../domain/sync/types'

const remoteKey = (table: SyncableTable, id: string) => `${table}\u001f${id}`

function matchesIntent(remote: RemoteRecord, operation: OutboxOperation) {
  return Object.entries(operation.payload).every(([field, value]) => {
    if (field === 'version' || field === 'updated_at') return true
    return JSON.stringify(remote[field]) === JSON.stringify(value)
  })
}

export class FakeSyncRemoteGateway implements SyncRemoteGateway {
  readonly records = new Map<string, RemoteRecord>()
  readonly seenOperations = new Map<string, RemoteRecord>()
  failBeforeApply = false
  loseAcknowledgement = false
  pushCalls = 0
  prepareCalls = 0
  private timestamp = Date.parse('2026-08-24T10:00:00.000Z')

  async prepare(_userId: string, _device: LocalDevice) {
    this.prepareCalls += 1
  }

  async push(operation: OutboxOperation): Promise<PushResult> {
    this.pushCalls += 1
    const seen = this.seenOperations.get(operation.operationId)
    if (seen) return { outcome: 'APPLIED', record: seen }
    if (this.failBeforeApply) {
      this.failBeforeApply = false
      return { outcome: 'RETRY', message: 'Tilapäinen verkkovirhe' }
    }

    const key = remoteKey(operation.table, operation.entityId)
    const current = this.records.get(key)
    if (operation.kind === 'INSERT' && current) {
      return matchesIntent(current, operation)
        ? { outcome: 'APPLIED', record: current }
        : { outcome: 'CONFLICT', remoteRecord: current }
    }
    if (
      operation.kind !== 'INSERT' &&
      (!current || current.version !== operation.baseVersion)
    ) {
      if (!current) return { outcome: 'RETRY', message: 'Tietuetta ei löytynyt' }
      return matchesIntent(current, operation)
        ? { outcome: 'APPLIED', record: current }
        : { outcome: 'CONFLICT', remoteRecord: current }
    }

    const record: RemoteRecord = {
      ...operation.payload,
      updated_at: this.nextTimestamp(),
      version: operation.kind === 'INSERT' ? 1 : (operation.baseVersion ?? 0) + 1,
    }
    this.records.set(key, record)
    this.seenOperations.set(operation.operationId, record)
    if (this.loseAcknowledgement) {
      this.loseAcknowledgement = false
      return { outcome: 'RETRY', message: 'Kuittaus katkesi' }
    }
    return { outcome: 'APPLIED', record }
  }

  async pull(
    userId: string,
    table: SyncableTable,
    cursor: SyncCursor | null,
    limit: number,
  ): Promise<PullPage> {
    const records = [...this.records.entries()]
      .filter(
        ([key, record]) => key.startsWith(`${table}\u001f`) && record.user_id === userId,
      )
      .map(([, record]) => record)
      .filter(
        (record) =>
          !cursor ||
          record.updated_at > cursor.updatedAt ||
          (record.updated_at === cursor.updatedAt && record.id > cursor.id),
      )
      .sort(
        (left, right) =>
          left.updated_at.localeCompare(right.updated_at) ||
          left.id.localeCompare(right.id),
      )
    return { records: records.slice(0, limit), hasMore: records.length > limit }
  }

  seed(table: SyncableTable, record: RemoteRecord) {
    this.records.set(remoteKey(table, record.id), record)
  }

  get(table: SyncableTable, id: string) {
    return this.records.get(remoteKey(table, id))
  }

  private nextTimestamp() {
    this.timestamp += 1000
    return new Date(this.timestamp).toISOString()
  }
}
