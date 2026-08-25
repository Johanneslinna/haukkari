import Dexie, { type Table } from 'dexie'
import type {
  LocalDevice,
  LocalRecord,
  LocalSyncConflict,
  OutboxOperation,
  SyncMetadata,
} from '../../domain/sync/types'

export type IndexedDbDependencies = {
  indexedDB: IDBFactory
  IDBKeyRange: typeof IDBKeyRange
}

export class TreenikompassiDatabase extends Dexie {
  records!: Table<LocalRecord, string>
  outbox!: Table<OutboxOperation, string>
  conflicts!: Table<LocalSyncConflict, string>
  metadata!: Table<SyncMetadata, string>
  devices!: Table<LocalDevice, string>

  constructor(name = 'treenikompassi', dependencies?: IndexedDbDependencies) {
    super(name, dependencies)
    this.version(1).stores({
      records:
        '&key, entityKey, id, userId, [userId+table], [userId+updatedAt+id], syncState',
      outbox:
        '&operationId, userId, [userId+state+nextAttemptAt], [userId+entityKey], createdAt',
      conflicts: '&id, userId, [userId+status], [userId+entityKey], createdAt',
      metadata: '&key, userId, [userId+table]',
      devices: '&id, userId, &[userId+deviceKey]',
    })
  }

  async clearUserData(userId: string) {
    await this.transaction(
      'rw',
      [this.records, this.outbox, this.conflicts, this.metadata, this.devices],
      async () => {
        await Promise.all([
          this.records.where('userId').equals(userId).delete(),
          this.outbox.where('userId').equals(userId).delete(),
          this.conflicts.where('userId').equals(userId).delete(),
          this.metadata.where('userId').equals(userId).delete(),
          this.devices.where('userId').equals(userId).delete(),
        ])
      },
    )
  }
}

export const localDatabase = new TreenikompassiDatabase()
