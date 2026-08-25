import { z } from 'zod'
import {
  syncableTables,
  type JsonObject,
  type LocalRecord,
  type SyncableTable,
} from '../../domain/sync/types'

export const DATA_EXPORT_FORMAT = 'haukkari-data-export' as const
export const LEGACY_DATA_EXPORT_FORMAT = 'treenikompassi-data-export' as const
export const DATA_EXPORT_SCHEMA_VERSION = 1 as const

const protectedFields = new Set([
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'version',
])

const exportedRecordSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  version: z.number().int().positive(),
  data: z.record(z.string(), z.json()),
})

const exportedTableSchema = z.object({
  table: z.enum(syncableTables),
  records: z.array(exportedRecordSchema),
})

const progressPhotoSchema = z.object({
  path: z.string().min(1),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  size: z.number().nonnegative().nullable(),
  mimeType: z.string().nullable(),
})

export const dataExportSchema = z.object({
  format: z.union([z.literal(DATA_EXPORT_FORMAT), z.literal(LEGACY_DATA_EXPORT_FORMAT)]),
  schemaVersion: z.literal(DATA_EXPORT_SCHEMA_VERSION),
  exportedAt: z.iso.datetime({ offset: true }),
  userId: z.uuid(),
  tables: z.array(exportedTableSchema),
  progressPhotos: z.array(progressPhotoSchema),
})

export type ExportedProgressPhoto = z.infer<typeof progressPhotoSchema>
export type HaukkariDataExport = {
  format: typeof DATA_EXPORT_FORMAT | typeof LEGACY_DATA_EXPORT_FORMAT
  schemaVersion: typeof DATA_EXPORT_SCHEMA_VERSION
  exportedAt: string
  userId: string
  tables: Array<{
    table: SyncableTable
    records: Array<{
      id: string
      createdAt: string
      updatedAt: string
      version: number
      data: JsonObject
    }>
  }>
  progressPhotos: ExportedProgressPhoto[]
}

export function mutableRecordData(record: LocalRecord): JsonObject {
  return Object.fromEntries(
    Object.entries(record.data).filter(([field]) => !protectedFields.has(field)),
  ) as JsonObject
}

export function buildDataExport(
  records: LocalRecord[],
  userId: string,
  progressPhotos: ExportedProgressPhoto[] = [],
  exportedAt = new Date(),
): HaukkariDataExport {
  const ownRecords = records.filter(
    (record) => record.userId === userId && record.deletedAt === null,
  )
  return {
    format: DATA_EXPORT_FORMAT,
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    userId,
    tables: syncableTables.map((table) => ({
      table,
      records: ownRecords
        .filter((record) => record.table === table)
        .map((record) => ({
          id: record.id,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          version: record.version,
          data: mutableRecordData(record),
        })),
    })),
    progressPhotos,
  }
}

export function serializeDataExport(data: HaukkariDataExport) {
  return `${JSON.stringify(data, null, 2)}\n`
}

export function parseDataExport(input: string): HaukkariDataExport {
  let value: unknown
  try {
    value = JSON.parse(input)
  } catch {
    throw new Error('Tiedosto ei ole kelvollista JSON-muotoa.')
  }
  const result = dataExportSchema.safeParse(value)
  if (!result.success) {
    throw new Error('Tiedosto ei ole tuettu Haukkari- tai Treenikompassi-vienti.')
  }
  return result.data as HaukkariDataExport
}

export function tableToCsv(records: LocalRecord[], table: SyncableTable) {
  const rows = records.filter(
    (record) => record.table === table && record.deletedAt === null,
  )
  const dataFields = [
    ...new Set(rows.flatMap((record) => Object.keys(record.data))),
  ].sort()
  const preferred = ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at', 'version']
  const fields = [
    ...preferred.filter((field) => dataFields.includes(field)),
    ...dataFields.filter((field) => !preferred.includes(field)),
  ]
  const lines = [fields.map(csvCell).join(',')]
  for (const record of rows) {
    lines.push(fields.map((field) => csvCell(csvValue(record.data[field]))).join(','))
  }
  return `\ufeff${lines.join('\r\n')}\r\n`
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

type RestoreTarget = {
  list: (table: SyncableTable) => LocalRecord[]
  create: (table: SyncableTable, data: JsonObject, id?: string) => Promise<LocalRecord>
  update: (record: LocalRecord, data: JsonObject) => Promise<LocalRecord>
}

export type RestoreResult = {
  created: number
  updated: number
  skipped: number
  skippedPushSubscriptions: number
}

export async function restoreDataExport(
  exported: HaukkariDataExport,
  target: RestoreTarget,
): Promise<RestoreResult> {
  const result: RestoreResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    skippedPushSubscriptions: 0,
  }

  for (const table of syncableTables) {
    const exportedTable = exported.tables.find((item) => item.table === table)
    if (!exportedTable) continue
    if (table === 'push_subscriptions') {
      result.skippedPushSubscriptions += exportedTable.records.length
      continue
    }
    const records =
      table === 'plan_versions'
        ? [...exportedTable.records].sort(
            (a, b) =>
              Number(a.data.version_number ?? 0) - Number(b.data.version_number ?? 0),
          )
        : exportedTable.records

    for (const record of records) {
      const existing = target.list(table).find((item) => item.id === record.id)
      if (existing) {
        result.skipped += 1
        continue
      }
      if (table === 'profiles') {
        const currentProfile = target.list('profiles')[0]
        if (currentProfile) {
          await target.update(currentProfile, record.data)
          result.updated += 1
          continue
        }
      }
      await target.create(table, record.data, record.id)
      result.created += 1
    }
  }
  return result
}
