import { describe, expect, it } from 'vitest'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'
import type { AppDataContextValue } from '../app-data/appDataContextValue'
import { calendarPlanningInputs } from './coachingActions'

const userId = '00000000-0000-4000-8000-000000000001'

function fixedSession(
  id: string,
  startsAt: string,
  recurrence: JsonObject = {},
): LocalRecord {
  return {
    key: id,
    entityKey: id,
    id,
    userId,
    table: 'fixed_sport_sessions',
    data: {
      id,
      user_id: userId,
      created_at: '2026-08-25T00:00:00.000Z',
      updated_at: '2026-08-25T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      starts_at: startsAt,
      duration_minutes: 75,
      rpe: 7,
      session_data: {
        sport_code: 'ice-hockey-adult-amateur-skater',
        event_kind: 'ICE_PRACTICE',
        recurrence,
      },
    },
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    syncState: 'SYNCED',
  }
}

function fakeData(records: LocalRecord[]): AppDataContextValue {
  return {
    records,
    loading: false,
    deviceId: '00000000-0000-4000-8000-000000000002',
    goalChangeDraft: null,
    setGoalChangeDraft: () => undefined,
    list: (table: SyncableTable) => records.filter((record) => record.table === table),
    latest: () => null,
    create: async () => {
      throw new Error('not used')
    },
    update: async () => {
      throw new Error('not used')
    },
    remove: async () => undefined,
    refresh: async () => undefined,
  }
}

describe('calendarPlanningInputs', () => {
  it('sisällyttää juuri luodun tietueen jo ennen React-kontekstin seuraavaa renderiä', () => {
    const created = fixedSession(
      '00000000-0000-4000-8000-000000000010',
      '2099-08-26T18:00:00.000Z',
    )
    const result = calendarPlanningInputs(fakeData([]), { upsert: created })

    expect(result.fixedSessions).toHaveLength(1)
    expect(result.fixedSessions[0]).toMatchObject({
      id: `calendar-${created.id}`,
      fixed: true,
      kind: 'SPORT',
    })
  })

  it('jättää menneen kertatapahtuman historiaksi mutta säilyttää viikoittaisen sarjan', () => {
    const pastOnce = fixedSession(
      '00000000-0000-4000-8000-000000000020',
      '2020-01-01T18:00:00.000Z',
    )
    const recurring = fixedSession(
      '00000000-0000-4000-8000-000000000030',
      '2020-01-01T18:00:00.000Z',
      { frequency: 'WEEKLY', interval: 1 },
    )

    const result = calendarPlanningInputs(fakeData([pastOnce, recurring]))
    expect(result.fixedSessions.map((session) => session.id)).toEqual([
      `calendar-${recurring.id}`,
    ])
  })
})
