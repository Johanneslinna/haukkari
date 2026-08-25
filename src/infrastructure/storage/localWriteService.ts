import { z } from 'zod'
import {
  entityKey,
  recordKey,
  syncableTables,
  type JsonObject,
  type LocalRecord,
  type OutboxOperation,
  type RemoteRecord,
  type SyncableTable,
} from '../../domain/sync/types'
import { TreenikompassiDatabase } from './localDatabase'

const writeSchema = z.object({
  userId: z.uuid(),
  deviceId: z.uuid(),
  table: z.enum(syncableTables),
  id: z.uuid().optional(),
  data: z.record(z.string(), z.json()).default({}),
  expectedVersion: z.number().int().positive().optional(),
})

export type LocalWriteInput = {
  userId: string
  deviceId: string
  table: SyncableTable
  id?: string
  data?: JsonObject
  expectedVersion?: number
}

type LocalWriteDependencies = {
  now?: () => Date
  uuid?: () => string
}

const protectedFields = new Set([
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'version',
])

function assertMutableFields(data: JsonObject) {
  for (const field of Object.keys(data)) {
    if (protectedFields.has(field)) {
      throw new Error(
        `Kenttää ${field} ei voi muuttaa paikallisen kirjoituspolun kautta.`,
      )
    }
  }
}

export class LocalWriteService {
  private readonly database: TreenikompassiDatabase
  private readonly now: () => Date
  private readonly uuid: () => string

  constructor(
    database: TreenikompassiDatabase,
    dependencies: LocalWriteDependencies = {},
  ) {
    this.database = database
    this.now = dependencies.now ?? (() => new Date())
    this.uuid = dependencies.uuid ?? (() => crypto.randomUUID())
  }

  async create(input: LocalWriteInput): Promise<LocalRecord> {
    const parsed = writeSchema.parse(input)
    assertMutableFields(parsed.data)
    const id = parsed.id ?? this.uuid()
    const timestamp = this.now().toISOString()
    const key = recordKey(parsed.userId, parsed.table, id)

    return this.database.transaction(
      'rw',
      [this.database.records, this.database.outbox],
      async () => {
        const existing = await this.database.records.get(key)
        if (existing && !existing.deletedAt) {
          throw new Error('Tietue on jo olemassa paikallisessa tietokannassa.')
        }

        const data: RemoteRecord = {
          ...parsed.data,
          id,
          user_id: parsed.userId,
          created_at: timestamp,
          updated_at: timestamp,
          deleted_at: null,
          version: 1,
        }
        const record = this.localRecord(parsed.userId, parsed.table, data, 'PENDING')
        const operation = this.operation(parsed, record, 'INSERT', null, timestamp)
        await this.database.records.put(record)
        await this.database.outbox.add(operation)
        return record
      },
    )
  }

  async update(input: Required<Pick<LocalWriteInput, 'id'>> & LocalWriteInput) {
    const parsed = writeSchema.extend({ id: z.uuid() }).parse(input)
    assertMutableFields(parsed.data)
    return this.changeExisting(parsed, 'UPDATE')
  }

  async remove(input: Omit<LocalWriteInput, 'data'> & { id: string }) {
    const parsed = writeSchema.omit({ data: true }).extend({ id: z.uuid() }).parse(input)
    return this.changeExisting({ ...parsed, data: {} }, 'DELETE')
  }

  private async changeExisting(
    input: z.infer<typeof writeSchema> & { id: string },
    kind: 'UPDATE' | 'DELETE',
  ) {
    const key = recordKey(input.userId, input.table, input.id)
    const timestamp = this.now().toISOString()

    return this.database.transaction(
      'rw',
      [this.database.records, this.database.outbox],
      async () => {
        const existing = await this.database.records.get(key)
        if (!existing) throw new Error('Paikallista tietuetta ei löytynyt.')
        if (input.expectedVersion && input.expectedVersion !== existing.version) {
          throw new Error('Tietue on muuttunut toisessa paikallisessa näkymässä.')
        }

        const baseVersion = existing.version
        const nextVersion = baseVersion + 1
        const deletedAt = kind === 'DELETE' ? timestamp : existing.deletedAt
        const localData: RemoteRecord = {
          ...existing.data,
          ...input.data,
          id: existing.id,
          user_id: existing.userId,
          created_at: existing.createdAt,
          updated_at: timestamp,
          deleted_at: deletedAt,
          version: nextVersion,
        }
        const payload: RemoteRecord = {
          ...localData,
          version: baseVersion,
        }
        const record = this.localRecord(input.userId, input.table, localData, 'PENDING')
        const operation = this.operation(
          input,
          record,
          kind,
          baseVersion,
          timestamp,
          payload,
        )
        await this.database.records.put(record)
        await this.database.outbox.add(operation)
        return record
      },
    )
  }

  private localRecord(
    userId: string,
    table: SyncableTable,
    data: RemoteRecord,
    syncState: LocalRecord['syncState'],
  ): LocalRecord {
    return {
      key: recordKey(userId, table, data.id),
      entityKey: entityKey(table, data.id),
      id: data.id,
      userId,
      table,
      data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deletedAt: data.deleted_at,
      version: data.version,
      syncState,
    }
  }

  private operation(
    input: z.infer<typeof writeSchema>,
    record: LocalRecord,
    kind: OutboxOperation['kind'],
    baseVersion: number | null,
    timestamp: string,
    payload = record.data,
  ): OutboxOperation {
    return {
      operationId: this.uuid(),
      userId: input.userId,
      deviceId: input.deviceId,
      entityKey: record.entityKey,
      entityId: record.id,
      table: record.table,
      kind,
      baseVersion,
      localVersion: record.version,
      payload,
      state: 'PENDING',
      attempts: 0,
      nextAttemptAt: timestamp,
      lastError: null,
      createdAt: timestamp,
    }
  }
}
