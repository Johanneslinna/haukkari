import { describe, expect, it } from 'vitest'
import type { LocalRecord } from '../../domain/sync/types'
import {
  buildDataExport,
  LEGACY_DATA_EXPORT_FORMAT,
  parseDataExport,
  restoreDataExport,
  serializeDataExport,
  tableToCsv,
} from './dataPortability'

const userId = '11111111-1111-4111-8111-111111111111'

function record(
  table: LocalRecord['table'],
  id: string,
  data: Record<string, unknown>,
): LocalRecord {
  const timestamp = '2026-08-24T10:00:00.000Z'
  return {
    key: `${userId}-${table}-${id}`,
    entityKey: `${table}-${id}`,
    id,
    userId,
    table,
    data: {
      ...data,
      id,
      user_id: userId,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      version: 3,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    version: 3,
    syncState: 'SYNCED',
  } as LocalRecord
}

describe('data portability', () => {
  it('round-trips goals, plan versions and history without auth credentials', () => {
    const records = [
      record('goal_profiles', '11111111-1111-4111-8111-111111111112', {
        primary_goal: 'FAT_LOSS',
      }),
      record('plan_versions', '11111111-1111-4111-8111-111111111113', {
        version_number: 2,
        snapshot: { days: 4 },
      }),
      record('workout_logs', '11111111-1111-4111-8111-111111111114', {
        notes: 'Historia säilyy',
      }),
    ]
    const parsed = parseDataExport(serializeDataExport(buildDataExport(records, userId)))

    expect(
      parsed.tables.find((item) => item.table === 'goal_profiles')?.records,
    ).toHaveLength(1)
    expect(
      parsed.tables.find((item) => item.table === 'plan_versions')?.records[0]?.data
        .snapshot,
    ).toEqual({ days: 4 })
    expect(
      parsed.tables.find((item) => item.table === 'workout_logs')?.records[0]?.data.notes,
    ).toBe('Historia säilyy')
    expect(JSON.stringify(parsed)).not.toContain('access_token')
  })

  it('accepts legacy Treenikompassi exports after the Haukkari rebrand', () => {
    const current = buildDataExport([], userId)
    const legacy = { ...current, format: LEGACY_DATA_EXPORT_FORMAT }

    expect(parseDataExport(JSON.stringify(legacy)).format).toBe(LEGACY_DATA_EXPORT_FORMAT)
  })

  it('escapes table CSV values according to RFC 4180 conventions', () => {
    const csv = tableToCsv(
      [
        record('workout_logs', '11111111-1111-4111-8111-111111111114', {
          notes: 'Vetoja, "kevyesti"\nuusi rivi',
        }),
      ],
      'workout_logs',
    )
    expect(csv).toContain('"Vetoja, ""kevyesti""\nuusi rivi"')
    expect(csv.startsWith('\ufeff')).toBe(true)
  })

  it('restores data in dependency order and never restores device push credentials', async () => {
    const calls: string[] = []
    const exported = buildDataExport(
      [
        record('goal_profiles', '11111111-1111-4111-8111-111111111112', {
          primary_goal: 'FAT_LOSS',
        }),
        record('plan_versions', '11111111-1111-4111-8111-111111111113', {
          version_number: 1,
        }),
        record('workout_logs', '11111111-1111-4111-8111-111111111114', {
          notes: 'Valmis',
        }),
        record('push_subscriptions', '11111111-1111-4111-8111-111111111115', {
          endpoint: 'https://push.invalid/secret',
        }),
      ],
      userId,
    )
    const result = await restoreDataExport(exported, {
      list: () => [],
      create: async (table, data, id) => {
        calls.push(table)
        return record(table, id!, data)
      },
      update: async (existing) => existing,
    })

    expect(calls).toEqual(['goal_profiles', 'plan_versions', 'workout_logs'])
    expect(result).toMatchObject({ created: 3, skippedPushSubscriptions: 1 })
  })
})
