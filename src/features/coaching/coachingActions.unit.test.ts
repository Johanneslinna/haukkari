import { describe, expect, it } from 'vitest'
import { resolvePrescription, STRENGTH_WEEK_POLICY_VERSION } from '../../domain/coaching'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'
import type { AppDataContextValue } from '../app-data/appDataContextValue'
import { planSessions, planStrengthWeek } from './coachingData'
import {
  addCompetition,
  calendarPlanningInputs,
  classifyOnboardingHealth,
  confirmNextAvailableLoad,
  ensureCurrentStrengthWeekPlan,
  saveDailyCheckIn,
  saveWorkoutAdaptation,
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

function rolloverFixture(
  options: {
    timezone?: string
    includeTimezone?: boolean
    weekAnchorDate?: string
    strengthWeekPolicyVersion?: string
  } = {},
) {
  const goalId = '40000000-0000-4000-8000-000000000001'
  const goalPeriodId = '40000000-0000-4000-8000-000000000002'
  const oldVersionId = '40000000-0000-4000-8000-000000000003'
  const oldPlanId = '40000000-0000-4000-8000-000000000004'
  const profileData: JsonObject = {
    app_settings: {
      age: 35,
      experience: 'INTERMEDIATE',
      availableDays: [1, 3],
      equipment: ['Kehonpaino', 'Käsipainot'],
      minutesPerSession: 45,
      physicalLoad: 'MODERATE',
    },
  }
  if (options.includeTimezone !== false) {
    profileData.timezone = options.timezone ?? 'Europe/Helsinki'
  }
  return mutableData([
    storedRecord('profiles', '40000000-0000-4000-8000-000000000000', profileData),
    storedRecord('goal_profiles', goalId, {
      primary_goal: 'MUSCLE_GAIN',
      secondary_goals: [],
      preferences: {
        age: 35,
        experience: 'INTERMEDIATE',
        availableDays: [1, 3],
        equipment: ['Kehonpaino', 'Käsipainot'],
        minutesPerSession: 45,
        physicalLoad: 'MODERATE',
      },
    }),
    storedRecord('goal_periods', goalPeriodId, {
      goal_profile_id: goalId,
      starts_on: '2026-08-01',
      status: 'ACTIVE',
    }),
    storedRecord('plan_versions', oldVersionId, {
      goal_period_id: goalPeriodId,
      previous_plan_version_id: null,
      version_number: 1,
      effective_from: options.weekAnchorDate ?? '2026-08-17',
      change_reason: 'WEEKLY_MATERIALIZATION',
      snapshot: { oldWeek: true },
    }),
    storedRecord('training_plans', oldPlanId, {
      plan_version_id: oldVersionId,
      status: 'ACTIVE',
      plan: {
        sessions: [],
        strengthWeek: {
          policyVersion:
            options.strengthWeekPolicyVersion ?? STRENGTH_WEEK_POLICY_VERSION,
          weekAnchorDate: options.weekAnchorDate ?? '2026-08-17',
        },
      },
    }),
  ])
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

describe('päivän kuntotarkistuksen päätöksen tallennus', () => {
  it('säilyttää voimakkaan DOMS:n vakaan reason coden prescription-sovitusta varten', async () => {
    const data = mutableData([])

    const result = await saveDailyCheckIn(data, {
      goal: 'GENERAL_FITNESS',
      plannedSession: 'STRENGTH',
      safetySymptoms: [],
      sleep: 'NORMAL',
      energy: 'NORMAL',
      stress: 'NORMAL',
      motivation: 'NORMAL',
      soreness: 'HIGH',
      illnessSymptoms: false,
      availableMinutes: 45,
    })

    expect(result.decision.volumeMultiplier).toBe(0.5)
    expect(data.list('daily_checkins')).toHaveLength(1)
    expect(data.list('daily_checkins')[0]?.data).toMatchObject({
      readiness: 'YELLOW',
      answers: {
        soreness: 'HIGH',
        recommendation: {
          volumeMultiplier: 0.5,
          reasonCodes: ['SEVERE_DOMS_STRENGTH_DELOAD', 'HIGH_SORENESS'],
        },
      },
    })
  })

  it('säilyttää DOMS-politiikan ja sarjamäärät workout- sekä logisnapshotissa', async () => {
    const workout = storedRecord('workouts', crypto.randomUUID(), {
      status: 'IN_PROGRESS',
    })
    const workoutLog = storedRecord('workout_logs', crypto.randomUUID(), {
      workout_id: workout.id,
      completion_status: 'IN_PROGRESS',
      decision_trace: {},
    })
    const data = mutableData([workout, workoutLog])
    const resolved = resolvePrescription({
      sessionId: 'persisted-doms-trace',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: {
        goal: 'GENERAL_FITNESS',
        experience: 'INTERMEDIATE',
        equipment: ['Kehonpaino', 'Käsipainot'],
        physicalLoad: 'MODERATE',
        minutesPerSession: 45,
        age: 35,
        readiness: 'GREEN',
        healthBlocked: false,
        generatedAt: '2026-08-28T10:00:00.000Z',
      },
    })
    if (resolved.status !== 'SUPPORTED') throw new Error(resolved.reasonCode)
    const prescription = {
      ...resolved.prescription,
      decisionTrace: {
        ...resolved.prescription.decisionTrace,
        ruleIds: ['adult-strength-severe-doms-1.0.0'],
        rules: [
          ...resolved.prescription.decisionTrace.rules,
          {
            ruleId: 'READINESS-SEVERE-DOMS-001',
            outcome: 'MODIFY' as const,
            message: 'DOMS-kevennys',
            evidenceIds: ['APP-CONSERVATIVE-LOAD-RULE'],
          },
        ],
        adaptations: [
          {
            original: { workingSetCount: 10 },
            adjusted: {
              workingSetCount: 5,
              maximumTargetRpe: 6,
              policyVersion: 'adult-strength-severe-doms-1.0.0',
            },
            reasonCodes: [
              'SEVERE_DOMS_STRENGTH_DELOAD',
              'SEVERE_DOMS_STRENGTH_PROGRESSION_FROZEN',
            ],
          },
        ],
      },
    }

    await saveWorkoutAdaptation(data, workout, prescription)

    expect(data.latest('workouts')?.data.prescription).toMatchObject({
      decisionTrace: {
        ruleIds: ['adult-strength-severe-doms-1.0.0'],
        adaptations: [
          {
            original: { workingSetCount: 10 },
            adjusted: {
              workingSetCount: 5,
              maximumTargetRpe: 6,
              policyVersion: 'adult-strength-severe-doms-1.0.0',
            },
          },
        ],
      },
    })
    expect(data.latest('workout_logs')?.data.decision_trace).toMatchObject({
      ruleIds: ['adult-strength-severe-doms-1.0.0'],
      adaptations: [
        {
          reasonCodes: [
            'SEVERE_DOMS_STRENGTH_DELOAD',
            'SEVERE_DOMS_STRENGTH_PROGRESSION_FROZEN',
          ],
        },
      ],
    })
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

describe('voimaviikon vaihtuminen', () => {
  it('muodostaa saman viikon uudelleen, kun suunnitelmaan jäi vanha turvallisuusesto', async () => {
    const data = rolloverFixture({ weekAnchorDate: '2026-08-24' })
    const profile = data.latest('profiles')!
    const goal = data.latest('goal_profiles')!
    await data.update(profile, {
      birth_date: '1991-01-01',
      app_settings: {
        experience: 'INTERMEDIATE',
        availableDays: [1, 3],
        equipment: ['Kehonpaino', 'Käsipainot'],
        minutesPerSession: 90,
        minutesByDay: { '1': 90, '3': 90 },
        physicalLoad: 'MODERATE',
      },
    })
    await data.update(goal, {
      preferences: {
        experience: 'INTERMEDIATE',
        availableDays: [1, 3],
        equipment: ['Kehonpaino', 'Käsipainot'],
        minutesPerSession: 90,
        minutesByDay: { '1': 90, '3': 90 },
        physicalLoad: 'MODERATE',
      },
    })
    const activePlan = data.latest('training_plans')!
    await data.update(activePlan, {
      plan: {
        sessions: [
          {
            id: 'stale-strength-session',
            day: 1,
            kind: 'STRENGTH',
            durationMinutes: 90,
            timeBudgetMinutes: 90,
            intensity: 'HARD',
            loadRegion: 'FULL_BODY',
            fixed: false,
            source: 'APP',
            unsupportedPrescription: {
              status: 'UNSUPPORTED',
              sessionKind: 'STRENGTH',
              reasonCode: 'SAFETY_INFORMATION_INCOMPLETE',
              userMessage: 'Vanhentunut turvallisuusesto',
            },
          },
        ],
        strengthWeek: {
          policyVersion: STRENGTH_WEEK_POLICY_VERSION,
          weekAnchorDate: '2026-08-24',
          reasonCodes: ['SAFETY_INFORMATION_INCOMPLETE'],
        },
      },
    })

    await expect(
      ensureCurrentStrengthWeekPlan(data, '2026-08-24T08:00:00.000Z'),
    ).resolves.toBe(true)

    const refreshedPlan = data
      .list('training_plans')
      .find((record) => record.data.status === 'ACTIVE')
    const refreshedPlanData = refreshedPlan?.data.plan as JsonObject
    expect(
      planSessions(refreshedPlanData).filter(
        (session) => session.kind === 'STRENGTH' && session.unsupportedPrescription,
      ),
    ).toHaveLength(0)
    expect(
      Object.values(planStrengthWeek(refreshedPlanData)?.plannedVolume ?? {}).reduce(
        (total, amount) => total + amount,
        0,
      ),
    ).toBeGreaterThan(0)
  })

  it('päivittää saman viikon vanhan aikabudjettipolitiikan uutena versiona', async () => {
    const stale = rolloverFixture({
      weekAnchorDate: '2026-08-24',
      strengthWeekPolicyVersion: 'adult-strength-week-1.0.0',
    })

    await expect(
      ensureCurrentStrengthWeekPlan(stale, '2026-08-26T08:00:00.000Z'),
    ).resolves.toBe(true)
    expect(stale.list('plan_versions')).toHaveLength(2)
    expect(
      (stale.list('training_plans').at(-1)?.data.plan as JsonObject | undefined)
        ?.strengthWeek,
    ).toMatchObject({
      policyVersion: STRENGTH_WEEK_POLICY_VERSION,
      weekAnchorDate: '2026-08-24',
    })
  })

  it('käyttää Helsingin paikallista maanantairajaa eikä UTC-vuorokauden rajaa', async () => {
    const sunday = rolloverFixture({ weekAnchorDate: '2026-08-24' })
    await expect(
      ensureCurrentStrengthWeekPlan(sunday, '2026-08-30T20:30:00.000Z'),
    ).resolves.toBe(false)
    expect(sunday.list('plan_versions')).toHaveLength(1)

    const monday = rolloverFixture({ weekAnchorDate: '2026-08-24' })
    await expect(
      ensureCurrentStrengthWeekPlan(monday, '2026-08-30T21:30:00.000Z'),
    ).resolves.toBe(true)
    expect(monday.list('plan_versions')).toHaveLength(2)
    expect(monday.list('plan_versions').at(-1)?.data.effective_from).toBe('2026-08-31')
  })

  it('muodostaa vanhasta viikosta uuden viikon kolmella odotetulla kirjoitusoperaatiolla', async () => {
    const data = rolloverFixture({ weekAnchorDate: '2026-08-24' })
    const previousPlanId = data.latest('training_plans')!.id
    const operations: Array<{
      table: SyncableTable
      kind: 'INSERT' | 'UPDATE'
      entityId: string
    }> = []
    const create = data.create.bind(data)
    const update = data.update.bind(data)
    data.create = async (table, payload, entityId) => {
      const record = await create(table, payload, entityId)
      operations.push({ table, kind: 'INSERT', entityId: record.id })
      return record
    }
    data.update = async (record, payload) => {
      const updated = await update(record, payload)
      operations.push({ table: record.table, kind: 'UPDATE', entityId: record.id })
      return updated
    }

    await expect(
      ensureCurrentStrengthWeekPlan(data, '2026-09-01T08:00:00.000Z'),
    ).resolves.toBe(true)

    expect(operations).toEqual([
      { table: 'plan_versions', kind: 'INSERT', entityId: expect.any(String) },
      { table: 'training_plans', kind: 'UPDATE', entityId: previousPlanId },
      { table: 'training_plans', kind: 'INSERT', entityId: expect.any(String) },
    ])
  })

  it('käyttää legacy-profiilille Helsinkiä mutta estää virheellisen aikavyöhykkeen', async () => {
    const legacy = rolloverFixture({ includeTimezone: false })
    await expect(
      ensureCurrentStrengthWeekPlan(legacy, '2026-08-30T21:30:00.000Z'),
    ).resolves.toBe(true)
    const invalid = rolloverFixture({ timezone: 'Not/A_Timezone' })
    await expect(
      ensureCurrentStrengthWeekPlan(invalid, '2026-08-30T21:30:00.000Z'),
    ).rejects.toThrow('INVALID_CALENDAR_TIME_ZONE')
  })

  it('tuottaa kahdella offline-laitteella samalle viikolle samat tunnisteet', async () => {
    const deviceA = rolloverFixture()
    const deviceB = rolloverFixture()
    await ensureCurrentStrengthWeekPlan(deviceA, '2026-08-24T08:00:00.000Z')
    await ensureCurrentStrengthWeekPlan(deviceB, '2026-08-24T12:00:00.000Z')
    expect(deviceA.list('plan_versions').at(-1)?.id).toBe(
      deviceB.list('plan_versions').at(-1)?.id,
    )
    expect(deviceA.list('training_plans').at(-1)?.id).toBe(
      deviceB.list('training_plans').at(-1)?.id,
    )
    expect(
      deviceA.list('training_plans').filter((record) => record.data.status === 'ACTIVE'),
    ).toHaveLength(1)
    expect(
      deviceB.list('training_plans').filter((record) => record.data.status === 'ACTIVE'),
    ).toHaveLength(1)
  })

  it('arkistoi edellisen viikon snapshotin ja luo nykyviikolle uuden version historiasta', async () => {
    const goalId = '20000000-0000-4000-8000-000000000001'
    const planId = '20000000-0000-4000-8000-000000000002'
    const goalPeriodId = '20000000-0000-4000-8000-000000000003'
    const oldVersionId = '20000000-0000-4000-8000-000000000004'
    const data = mutableData([
      storedRecord('profiles', '20000000-0000-4000-8000-000000000000', {
        timezone: 'Europe/Helsinki',
        app_settings: {
          age: 35,
          experience: 'INTERMEDIATE',
          availableDays: [1, 2],
          equipment: ['Kehonpaino', 'Käsipainot'],
          minutesPerSession: 45,
          physicalLoad: 'MODERATE',
        },
      }),
      storedRecord('goal_profiles', goalId, {
        primary_goal: 'MUSCLE_GAIN',
        secondary_goals: [],
        preferences: {
          age: 35,
          experience: 'INTERMEDIATE',
          availableDays: [1, 2],
          equipment: ['Kehonpaino', 'Käsipainot'],
          minutesPerSession: 45,
          physicalLoad: 'MODERATE',
        },
      }),
      storedRecord('goal_periods', goalPeriodId, {
        goal_profile_id: goalId,
        starts_on: '2026-08-01',
        status: 'ACTIVE',
      }),
      storedRecord('plan_versions', oldVersionId, {
        goal_period_id: goalPeriodId,
        previous_plan_version_id: null,
        version_number: 1,
        effective_from: '2026-08-17',
        change_reason: 'WEEKLY_MATERIALIZATION',
        snapshot: { immutableLegacyWeek: true },
      }),
      storedRecord('training_plans', planId, {
        plan_version_id: oldVersionId,
        status: 'ACTIVE',
        plan: {
          sessions: [],
          strengthWeek: {
            policyVersion: 'adult-strength-week-1.0.0',
            weekAnchorDate: '2026-08-17',
          },
        },
      }),
    ])

    await expect(
      ensureCurrentStrengthWeekPlan(data, '2026-08-24T08:00:00.000Z'),
    ).resolves.toBe(true)
    expect(
      data.list('training_plans').find((plan) => plan.id === planId)?.data.status,
    ).toBe('ARCHIVED')
    const replacement = data.list('training_plans').at(-1)
    expect(replacement?.data).not.toHaveProperty('change_reason')
    expect(replacement?.data.status).toBe('ACTIVE')
    expect(
      (replacement?.data.plan as JsonObject | undefined)?.strengthWeek,
    ).toMatchObject({
      policyVersion: STRENGTH_WEEK_POLICY_VERSION,
      weekAnchorDate: '2026-08-24',
    })
    expect(data.list('plan_versions')).toHaveLength(2)
    expect(data.list('plan_versions').at(-1)?.data).toMatchObject({
      change_reason: 'WEEKLY_MATERIALIZATION',
      snapshot: {
        materialization: {
          idempotencyKey: expect.stringContaining('weekly:'),
          trainingPlanId: replacement?.id,
        },
      },
    })
    expect(data.list('plan_versions')[0]?.data.snapshot).toEqual({
      immutableLegacyWeek: true,
    })
    await expect(
      ensureCurrentStrengthWeekPlan(data, '2026-08-24T09:00:00.000Z'),
    ).resolves.toBe(false)
    expect(data.list('plan_versions')).toHaveLength(2)
    expect(data.list('training_plans')).toHaveLength(2)
  })
})
