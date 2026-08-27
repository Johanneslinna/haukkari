import { describe, expect, it } from 'vitest'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'
import type { AppDataContextValue } from '../app-data/appDataContextValue'
import {
  addCompetition,
  calendarPlanningInputs,
  classifyOnboardingHealth,
  confirmNextAvailableLoad,
} from './coachingActions'

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

function storedRecord(
  table: SyncableTable,
  id: string,
  data: JsonObject,
  ownerUserId = userId,
): LocalRecord {
  const timestamp = '2026-08-25T00:00:00.000Z'
  return {
    key: `${table}-${id}`,
    entityKey: `${table}-${id}`,
    id,
    userId: ownerUserId,
    table,
    data: {
      id,
      user_id: ownerUserId,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      version: 1,
      ...data,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    version: 1,
    syncState: 'SYNCED',
  }
}

function mutableData(initial: LocalRecord[]): AppDataContextValue {
  const records = [...initial]
  return {
    records,
    loading: false,
    deviceId: '00000000-0000-4000-8000-000000000002',
    goalChangeDraft: null,
    setGoalChangeDraft: () => undefined,
    list: (table) => records.filter((record) => record.table === table),
    latest: (table) =>
      [...records].reverse().find((record) => record.table === table) ?? null,
    create: async (table, data, requestedId) => {
      const record = storedRecord(table, requestedId ?? crypto.randomUUID(), data)
      records.push(record)
      return record
    },
    update: async (record, data) => {
      const index = records.findIndex((candidate) => candidate.key === record.key)
      const updated = { ...record, data: { ...record.data, ...data } }
      records[index] = updated
      return updated
    },
    remove: async (record) => {
      const index = records.findIndex((candidate) => candidate.key === record.key)
      if (index >= 0) records.splice(index, 1)
    },
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

describe('aloituskartoituksen terveysrajat', () => {
  const normal = {
    healthConcern: false,
    exertionWarningSymptoms: false,
    doctorRestrictions: '',
    currentInjuries: '',
    pelvicFloorSymptoms: '',
    pregnancyStatus: 'NOT_APPLICABLE' as const,
  }

  it('ei muuta tavallista vamma- tai mieltymystekstiä yleiseksi terveysestoksi', () => {
    expect(
      classifyOnboardingHealth({
        ...normal,
        currentInjuries: 'Vanha polvi jäykistyy joskus, mutta ei ole kipeä',
      }),
    ).toEqual({
      safetyReviewRequired: false,
      highIntensityBlocked: false,
    })
  })

  it('ohjaa rasituksen varoitusoireen arvioon ja estää kovan harjoittelun', () => {
    expect(
      classifyOnboardingHealth({ ...normal, exertionWarningSymptoms: true }),
    ).toEqual({ safetyReviewRequired: true, highIntensityBlocked: true })
  })

  it('käsittelee lääkärin kuormitusrajoituksen korkean intensiteetin rajana', () => {
    expect(
      classifyOnboardingHealth({
        ...normal,
        doctorRestrictions: 'Vältä raskasta alavartalokuormaa',
      }).highIntensityBlocked,
    ).toBe(true)
  })
})

describe('käyttäjän vahvistama seuraava kuorma', () => {
  it('tallentaa vahvistuksen profiilin synkronoitavaan JSON-asetukseen', async () => {
    const profile = storedRecord('profiles', crypto.randomUUID(), {
      app_settings: {
        equipment: ['Käsipainot'],
        minutesPerSession: 45,
        notificationPreferences: { workoutReminder: true },
        verifiedNextLoads: [],
      },
    })
    const data = mutableData([profile])
    const result = await confirmNextAvailableLoad(data, {
      exerciseCode: 'GOBLET_SQUAT',
      exerciseVersion: '1.0.0',
      loadType: 'DUMBBELL_KG_EACH',
      loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
      currentLoadKg: 20,
      nextAvailableLoadKg: 21,
    })

    expect(result).toMatchObject({ ok: true })
    expect(data.latest('profiles')?.data.app_settings).toMatchObject({
      equipment: ['Käsipainot'],
      minutesPerSession: 45,
      notificationPreferences: { workoutReminder: true },
      verifiedNextLoads: [
        expect.objectContaining({
          exerciseCode: 'GOBLET_SQUAT',
          exerciseVersion: '1.0.0',
          currentLoadKg: 20,
          nextAvailableLoadKg: 21,
          policyVersion: 'verified-next-load-1.0.0',
        }),
      ],
    })
  })

  it('säilyttää vahvistuksen vain sen käyttäjän profiilissa, joka sen teki', async () => {
    const userA = '00000000-0000-4000-8000-00000000000a'
    const userB = '00000000-0000-4000-8000-00000000000b'
    const dataA = mutableData([
      storedRecord(
        'profiles',
        crypto.randomUUID(),
        { app_settings: { verifiedNextLoads: [] } },
        userA,
      ),
    ])
    const dataB = mutableData([
      storedRecord(
        'profiles',
        crypto.randomUUID(),
        { app_settings: { verifiedNextLoads: [] } },
        userB,
      ),
    ])

    const result = await confirmNextAvailableLoad(dataA, {
      exerciseCode: 'GOBLET_SQUAT',
      exerciseVersion: '1.0.0',
      loadType: 'DUMBBELL_KG_EACH',
      loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
      currentLoadKg: 20,
      nextAvailableLoadKg: 21,
    })

    expect(result).toMatchObject({ ok: true })
    expect(dataA.latest('profiles')?.userId).toBe(userA)
    expect(dataA.latest('profiles')?.data.app_settings).toMatchObject({
      verifiedNextLoads: [expect.objectContaining({ nextAvailableLoadKg: 21 })],
    })
    expect(dataB.latest('profiles')?.userId).toBe(userB)
    expect(dataB.latest('profiles')?.data.app_settings).toEqual({
      verifiedNextLoads: [],
    })
  })

  it('estää 5 → 6 kg UI-palvelureitillä eikä muuta profiilia', async () => {
    const profile = storedRecord('profiles', crypto.randomUUID(), {
      app_settings: { equipment: ['Käsipainot'], verifiedNextLoads: [] },
    })
    const data = mutableData([profile])
    const result = await confirmNextAvailableLoad(data, {
      exerciseCode: 'GOBLET_SQUAT',
      exerciseVersion: '1.0.0',
      loadType: 'DUMBBELL_KG_EACH',
      loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
      currentLoadKg: 5,
      nextAvailableLoadKg: 6,
    })

    expect(result).toMatchObject({
      ok: false,
      reasonCode: 'NEXT_LOAD_EXCEEDS_TEN_PERCENT',
    })
    expect(data.latest('profiles')?.data.app_settings).toEqual(profile.data.app_settings)
  })
})

describe('kalenterin replanner', () => {
  it('luo kilpailusta uuden suunnitelmaversion, säilyttää historian ja kirjaa reason coden', async () => {
    const goalProfileId = '10000000-0000-4000-8000-000000000001'
    const goalPeriodId = '10000000-0000-4000-8000-000000000002'
    const oldVersionId = '10000000-0000-4000-8000-000000000003'
    const oldPlanId = '10000000-0000-4000-8000-000000000004'
    const historyId = '10000000-0000-4000-8000-000000000005'
    const data = mutableData([
      storedRecord('profiles', '10000000-0000-4000-8000-000000000000', {
        app_settings: {
          experience: 'BEGINNER',
          availableDays: [1, 3, 5],
          equipment: ['Kehonpaino'],
          minutesPerSession: 30,
          physicalLoad: 'MODERATE',
        },
      }),
      storedRecord('goal_profiles', goalProfileId, {
        primary_goal: 'GENERAL_FITNESS',
        secondary_goals: [],
        preferences: {
          age: 30,
          experience: 'BEGINNER',
          availableDays: [1, 3, 5],
          currentEnduranceMinutes: 60,
          equipment: ['Kehonpaino'],
          minutesPerSession: 30,
          physicalLoad: 'MODERATE',
        },
      }),
      storedRecord('goal_periods', goalPeriodId, {
        goal_profile_id: goalProfileId,
        status: 'ACTIVE',
      }),
      storedRecord('plan_versions', oldVersionId, {
        goal_period_id: goalPeriodId,
        version_number: 1,
        change_reason: 'Aloituskartoitus',
        snapshot: {},
      }),
      storedRecord('training_plans', oldPlanId, {
        plan_version_id: oldVersionId,
        status: 'ACTIVE',
        plan: { sessions: [] },
      }),
      storedRecord('workout_logs', historyId, {
        performed_at: '2026-08-20T10:00:00.000Z',
        completion_status: 'COMPLETED',
      }),
    ])

    await addCompetition(data, {
      name: 'Testiottelu',
      startsAt: '2099-09-01T18:00:00.000Z',
      priority: 'A',
    })

    const versions = data.list('plan_versions')
    expect(versions).toHaveLength(2)
    expect(versions.at(-1)?.data.change_reason).toBe('COMPETITION_ADDED')
    expect(
      data.list('training_plans').find((plan) => plan.id === oldPlanId)?.data.status,
    ).toBe('ARCHIVED')
    expect(data.list('training_plans').at(-1)?.data.status).toBe('ACTIVE')
    expect(data.list('workout_logs').map((record) => record.id)).toContain(historyId)
  })
})
