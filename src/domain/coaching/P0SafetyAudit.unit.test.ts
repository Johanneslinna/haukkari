import { describe, expect, it } from 'vitest'
import {
  MAX_ROLLING_MUSCLE_SETS,
  adaptPrescription,
  adaptNextSet,
  addPlannedSets,
  calculateRollingMuscleVolume,
  decideInterSessionProgression,
  evaluateReadiness,
  evaluateStrengthSafetyGate,
  filterEligibleExercises,
  generatePlan,
  maximumAdditionalSets,
  prescribeAdultResistanceSession,
  publishedExerciseCatalog,
  resolvePrescription,
  type AdultResistanceAthleteContext,
  type AdultResistanceSetHistory,
  type PrescriptionAdaptationSafetyContext,
  type PrescribedSession,
  type WorkoutVariant,
} from '.'
import type { JsonObject, LocalRecord, SyncableTable } from '../sync/types'
import type { AppDataContextValue } from '../../features/app-data/appDataContextValue'
import {
  completeOnboarding,
  completeWorkout,
  saveWorkoutAdaptation,
  startWorkout,
  type OnboardingInput,
} from '../../features/coaching/coachingActions'
import {
  canResumeWorkout,
  isLockedSafetyOutcome,
} from '../../features/workout/WorkoutSafetyState'

const generatedAt = '2026-08-27T08:00:00.000Z'
const userId = '00000000-0000-4000-8000-000000000001'
const externalLoadContext = 'adult-resistance-load-context-1.0.0:external-kg'

function successfulProgressionSet(
  overrides: Partial<AdultResistanceSetHistory> = {},
): AdultResistanceSetHistory {
  return {
    sessionId: 'workout-1',
    exerciseCode: 'TEST_LIFT',
    exerciseVersion: '1.0.0',
    loadKg: 40,
    loadType: 'EXTERNAL_KG',
    loadContextId: externalLoadContext,
    loadIncrementKg: 2.5,
    repetitions: 8,
    rir: 3,
    completedAt: '2026-08-20T08:00:00.000Z',
    pain: false,
    techniqueOk: true,
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    ...overrides,
  }
}

function storedRecord(table: SyncableTable, id: string, data: JsonObject): LocalRecord {
  const timestamp = '2026-08-25T00:00:00.000Z'
  return {
    key: `${table}-${id}`,
    entityKey: `${table}-${id}`,
    id,
    userId,
    table,
    data: {
      id,
      user_id: userId,
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

function mutableData(initial: LocalRecord[] = []): AppDataContextValue {
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

function onboardingInput(patch: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    displayName: 'Legacy-testaaja',
    age: 35,
    heightCm: 175,
    weightKg: 75,
    primaryGoal: 'GENERAL_FITNESS',
    secondaryGoals: [],
    targetDate: '',
    experience: 'BEGINNER',
    previousRegularStrengthTraining: false,
    lastStrengthWorkoutDate: '',
    availableDays: [1, 3, 5],
    minutesPerSession: 45,
    minutesByDay: { '1': 45, '3': 45, '5': 45 },
    currentEnduranceMinutes: 0,
    weeklyActivities: [],
    currentWeeklyTraining: '',
    enduranceSportBackground: '',
    physicalLoad: 'MODERATE',
    equipment: ['Kehonpaino', 'Käsipainot'],
    likes: '',
    dislikes: '',
    sleepHours: 8,
    dietRestrictions: '',
    trackingMode: 'PORTIONS',
    healthConcern: false,
    healthNotes: '',
    medicationAffectsHeartRate: false,
    pregnancyStatus: 'NOT_APPLICABLE',
    doctorRestrictions: '',
    currentInjuries: '',
    confirmedLimitationTags: [],
    pelvicFloorSymptoms: '',
    exertionWarningSymptoms: false,
    eatingDisorderHistory: false,
    menstrualTrackingOptIn: false,
    desiredMetrics: [],
    sensitiveConsent: true,
    ...patch,
  }
}

function context(
  patch: Partial<AdultResistanceAthleteContext> = {},
): AdultResistanceAthleteContext {
  return {
    age: 35,
    contentReleaseId: 'adult-resistance-v1.0.0',
    ruleVersion: 'adult-resistance-rules-1.0.0',
    experience: 'BEGINNER',
    goal: 'GENERAL_FITNESS',
    equipment: ['Kehonpaino', 'Käsipainot', 'Vastuskuminauhat'],
    environment: 'HOME',
    availableMinutes: 45,
    generatedAt,
    physicalLoad: 'MODERATE',
    readiness: 'GREEN',
    limitationTags: [],
    dislikedExerciseCodes: [],
    likedExerciseCodes: [],
    supervisionAvailable: false,
    ...patch,
  }
}

const fullVariant: WorkoutVariant = {
  kind: 'FULL',
  durationMinutes: 45,
  volumeMultiplier: 1,
}

function adaptationSafety(
  patch: Partial<PrescriptionAdaptationSafetyContext> = {},
): PrescriptionAdaptationSafetyContext {
  return {
    age: 35,
    readiness: 'GREEN',
    healthBlocked: false,
    safetyInformationComplete: true,
    ...patch,
  }
}

function strengthPrescription() {
  const result = resolvePrescription({
    sessionId: 'adaptation-safety-base',
    title: 'Mukautuksen turvallisuusportti',
    kind: 'STRENGTH',
    durationMinutes: 45,
    profile: {
      goal: 'GENERAL_FITNESS',
      experience: 'BEGINNER',
      equipment: ['Kehonpaino'],
      physicalLoad: 'MODERATE',
      minutesPerSession: 45,
      age: 35,
      readiness: 'GREEN',
      healthBlocked: false,
      generatedAt,
    },
  })
  if (result.status !== 'SUPPORTED') throw new Error(result.reasonCode)
  return result.prescription
}

describe('P0-1: keskitetty fail-closed beta- ja turvallisuusportti', () => {
  it('estää ikä-, valmius-, terveys- ja puuttuvan tiedon negatiivikontrollit', () => {
    const legacyMinimumAgeOnly = (age: number) => age >= 18
    expect(legacyMinimumAgeOnly(65)).toBe(true) // Vanha pelkkä alaikäraja olisi päästänyt tapauksen läpi.
    expect(
      evaluateStrengthSafetyGate({
        sessionKind: 'STRENGTH',
        age: 65,
        readiness: 'GREEN',
      }),
    ).toEqual({ allowed: false, reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE' })
    expect(
      evaluateStrengthSafetyGate({
        sessionKind: 'STRENGTH',
        age: 17,
        readiness: 'GREEN',
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'YOUTH_ENGINE_NOT_AVAILABLE' })
    expect(
      evaluateStrengthSafetyGate({ sessionKind: 'STRENGTH', age: 30 }),
    ).toMatchObject({ allowed: false, reasonCode: 'SAFETY_INFORMATION_INCOMPLETE' })
    expect(
      evaluateStrengthSafetyGate({
        sessionKind: 'STRENGTH',
        age: 30,
        readiness: 'RED_STOP',
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'READINESS_RED_STOP' })
    expect(
      evaluateStrengthSafetyGate({
        sessionKind: 'STRENGTH',
        age: 30,
        readiness: 'ORANGE_RECOVERY',
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'READINESS_RECOVERY_ONLY' })
    expect(
      evaluateStrengthSafetyGate({
        sessionKind: 'STRENGTH',
        age: 30,
        readiness: 'GREEN',
        healthBlocked: true,
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'HEALTH_ENGINE_NOT_AVAILABLE' })
    expect(() =>
      prescribeAdultResistanceSession({
        sessionId: 'direct-bypass-attempt',
        title: 'Ei sallittu',
        context: context({ age: 65 }),
      }),
    ).toThrow('OLDER_ADULT_ENGINE_NOT_AVAILABLE')
  })

  it('käyttää samaa porttia julkisessa prescription-API:ssa ja PlanGeneratorissa', () => {
    const central = resolvePrescription({
      sessionId: 'central-route',
      title: 'Keskitetty reitti',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: {
        goal: 'GENERAL_FITNESS',
        experience: 'BEGINNER',
        equipment: ['Kehonpaino', 'Vastuskuminauhat'],
        physicalLoad: 'MODERATE',
        minutesPerSession: 45,
        age: 65,
        readiness: 'GREEN',
        generatedAt,
      },
    })
    expect(central).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE',
    })

    const planInput = {
      goal: { primary: 'GENERAL_FITNESS' as const, secondary: [], inputs: {} },
      experience: 'BEGINNER' as const,
      availableDays: [1, 2, 3, 4, 5],
      currentEnduranceMinutes: 0,
      fixedSessions: [],
      competitions: [],
      equipment: ['Kehonpaino', 'Vastuskuminauhat'],
      physicalLoad: 'MODERATE' as const,
      minutesPerSession: 45,
      generatedAt,
      calendarTimeZone: 'Europe/Helsinki',
      localDate: '2026-08-27',
      weekAnchorDate: '2026-08-24',
    }
    const blockedPlan = generatePlan({ ...planInput, age: 65 })
    expect(
      blockedPlan.decision.sessions.find(
        (session) => session.source === 'APP' && session.kind === 'STRENGTH',
      )?.unsupportedPrescription,
    ).toMatchObject({ reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE' })
    const allowedPlan = generatePlan({ ...planInput, age: 35 })
    expect(
      allowedPlan.decision.sessions.find(
        (session) => session.source === 'APP' && session.kind === 'STRENGTH',
      )?.prescriptionDetail?.exercises.length,
    ).toBeGreaterThan(0)
  })

  it('portittaa myös julkisen adaptPrescription-tuotantoreitin nykyhetken tiedoilla', () => {
    const prescription = strengthPrescription()
    const cases = [
      {
        label: 'alaikäinen',
        safety: adaptationSafety({ age: 17 }),
        reasonCode: 'YOUTH_ENGINE_NOT_AVAILABLE',
      },
      {
        label: '65-vuotias',
        safety: adaptationSafety({ age: 65 }),
        reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE',
      },
      {
        label: 'terveysesto',
        safety: adaptationSafety({ healthBlocked: true }),
        reasonCode: 'HEALTH_ENGINE_NOT_AVAILABLE',
      },
      {
        label: 'punainen valmius',
        safety: adaptationSafety({ readiness: 'RED_STOP' }),
        reasonCode: 'READINESS_RED_STOP',
      },
    ] as const

    for (const testCase of cases) {
      expect(
        adaptPrescription(prescription, fullVariant, testCase.safety),
        testCase.label,
      ).toMatchObject({ status: 'UNSUPPORTED', reasonCode: testCase.reasonCode })
    }

    expect(
      adaptPrescription(prescription, fullVariant, adaptationSafety({ age: 64 })),
    ).toMatchObject({
      status: 'SUPPORTED',
      prescription: { kind: 'STRENGTH' },
    })
  })

  it('estää puutteellisen ja ennen P0-porttia tallennetun legacy-snapshotin', () => {
    const current = strengthPrescription()
    const legacyPrescription: PrescribedSession = { ...current }
    delete legacyPrescription.schemaVersion
    delete legacyPrescription.engineVersion

    expect(
      adaptPrescription(
        legacyPrescription,
        fullVariant,
        adaptationSafety({
          age: undefined,
          readiness: undefined,
          healthBlocked: undefined,
          safetyInformationComplete: undefined,
        }),
      ),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'SAFETY_INFORMATION_INCOMPLETE',
    })
    expect(
      adaptPrescription(legacyPrescription, fullVariant, adaptationSafety({ age: 65 })),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE',
    })
  })

  it('arvioi aiemman prescriptionin uudelleen, kun käyttäjä täyttää 65 vuotta', () => {
    const prescription = strengthPrescription()
    expect(
      adaptPrescription(prescription, fullVariant, adaptationSafety({ age: 64 })),
    ).toMatchObject({ status: 'SUPPORTED', prescription: { kind: 'STRENGTH' } })
    expect(
      adaptPrescription(prescription, fullVariant, adaptationSafety({ age: 65 })),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE',
    })
  })

  it('korvaa ORANGE-tilassa voiman vain hyväksytyllä palauttavalla reitillä', () => {
    const result = adaptPrescription(
      strengthPrescription(),
      fullVariant,
      adaptationSafety({ readiness: 'ORANGE_RECOVERY' }),
    )
    expect(result).toMatchObject({
      status: 'SUPPORTED',
      prescription: { kind: 'RECOVERY', title: 'Palauttava vaihtoehto' },
    })
    if (result.status !== 'SUPPORTED') throw new Error(result.reasonCode)
    expect(result.prescription.exercises).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dose: expect.objectContaining({ kind: 'STRENGTH_SETS' }),
        }),
      ]),
    )
  })
})

describe('P0-2: sarjan todellinen kipu ja tekniikka', () => {
  const base = {
    prescribedRepetitions: 8,
    targetRir: [2, 3] as [number, number],
    completedRepetitions: 8,
    completedRir: 3,
    experience: 'INTERMEDIATE' as const,
    loadIncrementKg: 2.5,
  }

  it('negatiivikontrolli osoittaa, että muuttunut kipusyöte muuttaa päätöksen', () => {
    expect(adaptNextSet({ ...base, pain: 'NONE', techniqueOk: true }).action).toBe(
      'MAINTAIN',
    )
    for (const pain of ['WORSENING', 'SHARP', 'FUNCTION_ALTERING'] as const) {
      expect(adaptNextSet({ ...base, pain, techniqueOk: true }).action).toBe(
        'STOP_EXERCISE',
      )
    }
    expect(adaptNextSet({ ...base, pain: 'NONE', techniqueOk: false }).action).toBe(
      'STOP_EXERCISE',
    )
  })
})

describe('P0-3: enintään 10 prosentin kuormaprogressio', () => {
  it('ei tulkitse saman WorkoutRecordin kahta sarjaa kahdeksi exposureksi', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulProgressionSet({ sessionId: 'same-workout' }),
        successfulProgressionSet({ sessionId: 'same-workout' }),
      ],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      targetRir: [2, 3],
      maximumRepetitions: 8,
      loadIncrementKg: 2.5,
      generatedAt,
    })

    expect(decision.action).toBe('KEEP_LOAD')
    expect(decision.supportingSessionIds).toEqual(['same-workout'])
  })

  it('estää 5 -> 6 kg eikä keksi väliportaita', () => {
    expect(6 / 5).toBeGreaterThan(1.1) // Mutatoitu vanha tulos rikkoo hyväksymisrajan.
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulProgressionSet({ loadKg: 5, repetitions: 10 }),
        successfulProgressionSet({
          sessionId: 'workout-2',
          loadKg: 5,
          repetitions: 10,
          completedAt: '2026-08-24T08:00:00.000Z',
        }),
      ],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetRir: [2, 3],
      verifiedNextLoads: [
        {
          exerciseCode: 'TEST_LIFT',
          exerciseVersion: '1.0.0',
          loadContextId: externalLoadContext,
          currentLoadKg: 5,
          nextAvailableLoadKg: 6,
          confirmedAt: generatedAt,
          policyVersion: 'verified-next-load-1.0.0',
        },
      ],
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      maximumRepetitions: 10,
      generatedAt,
    })
    expect(decision.action).toBe('KEEP_LOAD')
    expect(decision.nextLoadKg).toBe(5)
    expect(decision.reasonCodes).toContain('VERIFIED_NEXT_LOAD_EXCEEDS_TEN_PERCENT')
  })

  it('ei hyväksy toisen version historiaa', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulProgressionSet({ exerciseVersion: '0.9.0' }),
        successfulProgressionSet({
          sessionId: 'workout-2',
          exerciseVersion: '0.9.0',
          completedAt: '2026-08-24T08:00:00.000Z',
        }),
      ],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetRir: [2, 3],
      loadIncrementKg: 2.5,
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      maximumRepetitions: 8,
      generatedAt,
    })
    expect(decision.reasonCodes).toContain('NO_COMPARABLE_SESSION_HISTORY')
  })
})

describe('P0-4: versionoitu lihaskohtainen viikkovolyymikatto', () => {
  it('laskee primary=1 ja secondary=0,5 ja leikkaa annoksen 16:een', () => {
    const exercise = publishedExerciseCatalog.getExercise('CHAIR_SQUAT')!
    const history: AdultResistanceSetHistory[] = Array.from({ length: 15 }, (_, i) => ({
      exerciseCode: exercise.code,
      exerciseVersion: exercise.version,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      loadKg: null,
      repetitions: 10,
      completedAt: `2026-08-${String(26 - (i % 3)).padStart(2, '0')}T08:00:00.000Z`,
      pain: false,
      techniqueOk: true,
    }))
    const rolling = calculateRollingMuscleVolume({
      sets: history,
      at: generatedAt,
      catalog: publishedExerciseCatalog,
    })
    expect(rolling.quadriceps).toBe(15)
    expect(rolling.trunk).toBe(7.5)
    expect(15 + 3).toBeGreaterThan(MAX_ROLLING_MUSCLE_SETS) // Ilman porttia 3 sarjaa ylittäisi katon.
    expect(
      maximumAdditionalSets({
        exercise,
        rollingVolume: rolling,
        sessionPrimaryVolume: {},
      }),
    ).toBe(1)

    const session = prescribeAdultResistanceSession({
      sessionId: 'weekly-cap',
      title: 'Katto',
      context: context(),
      history,
    })
    const combined = { ...rolling }
    const sessionPrimary = {}
    for (const prescribed of session.exercises) {
      const definition = publishedExerciseCatalog.getExercise(prescribed.code)!
      addPlannedSets({
        exercise: definition,
        sets: prescribed.sets,
        rollingVolume: combined,
        sessionPrimaryVolume: sessionPrimary,
      })
    }
    expect(Math.max(...Object.values(combined))).toBeLessThanOrEqual(
      MAX_ROLLING_MUSCLE_SETS,
    )
  })
})

describe('P0-5: vain vahvistetut rajoitetunnisteet ovat hard constraint', () => {
  it('negatiivikontrollissa pystyliike on kelvollinen ilman tunnistetta ja estyy tunnisteella', () => {
    const objective = {
      ...prescribeAdultResistanceSession({
        sessionId: 'objective-source',
        title: 'Testi',
        context: context(),
      }).objective!,
      requiredMovementPatterns: ['VERTICAL_PUSH'],
    }
    const withoutConfirmation = filterEligibleExercises(
      publishedExerciseCatalog,
      context({ limitationTags: [] }),
      objective,
    )
    const withConfirmation = filterEligibleExercises(
      publishedExerciseCatalog,
      context({ limitationTags: ['OVERHEAD_RESTRICTION'] }),
      objective,
    )
    const overheadCodes = publishedExerciseCatalog
      .listExercises()
      .filter((item) => item.contraindicationTags.includes('OVERHEAD_RESTRICTION'))
      .map((item) => item.code)
    expect(
      withoutConfirmation
        .filter((item) => overheadCodes.includes(item.exercise.code))
        .every((item) => !item.reasonCodes.includes('CONTRAINDICATION_MATCH')),
    ).toBe(true)
    expect(
      withConfirmation
        .filter((item) => overheadCodes.includes(item.exercise.code))
        .every(
          (item) => !item.eligible && item.reasonCodes.includes('CONTRAINDICATION_MATCH'),
        ),
    ).toBe(true)
  })

  it('estää legacy-vapaatekstin coachingActions-reitillä ja lukee vanhan historian', async () => {
    const legacyHistory: AdultResistanceSetHistory[] = [
      {
        exerciseCode: 'CHAIR_SQUAT',
        loadKg: null,
        repetitions: 10,
        completedAt: '2026-08-24T08:00:00.000Z',
      },
    ]
    const historyCompatible = resolvePrescription({
      sessionId: 'legacy-history',
      title: 'Vanha historia',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: {
        goal: 'GENERAL_FITNESS',
        experience: 'BEGINNER',
        equipment: ['Kehonpaino'],
        physicalLoad: 'MODERATE',
        minutesPerSession: 45,
        age: 35,
        readiness: 'GREEN',
        generatedAt,
        strengthHistory: legacyHistory,
      },
    })
    expect(historyCompatible.status).toBe('SUPPORTED')

    const oldWorkoutLog = storedRecord(
      'workout_logs',
      '00000000-0000-4000-8000-000000000099',
      {
        performed_at: '2026-08-24T08:00:00.000Z',
        completion_status: 'COMPLETED',
        feedback: {
          exerciseResults: [
            {
              exerciseCode: 'CHAIR_SQUAT',
              exerciseName: 'Tuolilta ylösnousu',
              loadType: 'BODYWEIGHT',
              completedSets: 2,
              repetitions: [10, 10],
              loadsKg: [null, null],
              rirs: [null, null],
              targetRpe: 6,
            },
          ],
        },
      },
    )
    const data = mutableData([oldWorkoutLog])
    await completeOnboarding(
      data,
      onboardingInput({
        currentInjuries: 'Vanha olkapään kuormitusrajoite',
        confirmedLimitationTags: undefined,
      }),
    )
    const plan = data.latest('training_plans')?.data.plan as unknown as {
      sessions: Array<{
        kind: string
        source: string
        unsupportedPrescription?: { reasonCode: string }
      }>
    }
    expect(
      plan.sessions.find(
        (session) => session.source === 'APP' && session.kind === 'STRENGTH',
      )?.unsupportedPrescription,
    ).toEqual({
      status: 'UNSUPPORTED',
      sessionKind: 'STRENGTH',
      reasonCode: 'SAFETY_INFORMATION_INCOMPLETE',
      userMessage: expect.any(String),
    })
    expect(data.list('workout_logs').map((record) => record.id)).toContain(
      oldWorkoutLog.id,
    )
  })
})

describe('P0-6: toispuoleinen pohjeturvotus ja lepokipu', () => {
  const readiness = (swelling: boolean, painAtRest: boolean) =>
    evaluateReadiness({
      goal: 'GENERAL_FITNESS',
      plannedSession: 'STRENGTH',
      safetySymptoms: [],
      sleep: 'NORMAL',
      energy: 'NORMAL',
      stress: 'NORMAL',
      motivation: 'NORMAL',
      soreness: 'NORMAL',
      illnessSymptoms: false,
      vascularSymptoms: {
        rapidlyIncreasingUnilateralCalfSwelling: swelling,
        painAtRest,
      },
      availableMinutes: 45,
    })

  it('yhdistelmä pysäyttää ilman automaattista 112-ohjetta', () => {
    expect(readiness(true, false).decision.state).toBe('GREEN') // Negatiivikontrolli: vain toinen ehto ei laukaise sääntöä.
    const result = readiness(true, true)
    expect(result.decision.state).toBe('RED_STOP')
    expect(result.reasons[0]?.code).toBe('UNILATERAL_CALF_SWELLING_WITH_REST_PAIN')
    expect(result.decision.action).not.toContain('112')
  })
})

describe('P0-7: vakava oire lukitsee STOP-tilan', () => {
  it('lukittua tilaa ei voi avata tavallisella jatkopolulla', () => {
    expect(canResumeWorkout(null)).toBe(true) // Negatiivikontrolli ilman lukkoa.
    expect(canResumeWorkout('SEVERE_PAIN_REPORTED')).toBe(false)
    expect(isLockedSafetyOutcome('STOP')).toBe(true)
    expect(
      adaptNextSet({
        prescribedRepetitions: 8,
        targetRir: [2, 3],
        completedRepetitions: 1,
        pain: 'SEVERE',
        techniqueOk: false,
        experience: 'BEGINNER',
        loadIncrementKg: 2.5,
      }),
    ).toMatchObject({
      action: 'REFER_SAFETY',
      reasonCodes: ['SEVERE_PAIN_REPORTED'],
    })
  })

  it('tallentaa sarjapalautteen ja lukitun STOP-päätöksen coachingActions-reitillä', async () => {
    const resolution = resolvePrescription({
      sessionId: 'stop-storage',
      title: 'STOP-tallennus',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: {
        goal: 'GENERAL_FITNESS',
        experience: 'BEGINNER',
        equipment: ['Kehonpaino'],
        physicalLoad: 'MODERATE',
        minutesPerSession: 45,
        age: 35,
        readiness: 'GREEN',
        generatedAt,
      },
    })
    expect(resolution.status).toBe('SUPPORTED')
    const prescription = (resolution as { prescription: PrescribedSession }).prescription
    const exercise = prescription.exercises[0]!
    const adaptation = adaptNextSet({
      prescribedRepetitions: 8,
      targetRir: [2, 3],
      completedRepetitions: 1,
      pain: 'SEVERE',
      techniqueOk: false,
      experience: 'BEGINNER',
      loadIncrementKg: 2.5,
    })
    const lockedPrescription: PrescribedSession = {
      ...prescription,
      decisionTrace: {
        ...prescription.decisionTrace,
        safetyOutcome: 'STOP',
        adaptations: [
          ...(prescription.decisionTrace.adaptations ?? []),
          {
            original: { sessionStatus: 'IN_PROGRESS' },
            adjusted: { sessionStatus: 'STOPPED' },
            reasonCodes: adaptation.reasonCodes,
          },
        ],
      },
    }
    const data = mutableData()
    const workout = await startWorkout(data, {
      title: prescription.title,
      durationMinutes: prescription.durationMinutes,
      intensity: 'HARD',
      variants: [],
      prescription,
    })
    await saveWorkoutAdaptation(data, workout, lockedPrescription)
    await completeWorkout(data, workout, {
      durationMinutes: 1,
      prescription: lockedPrescription,
      sets: [
        {
          exerciseId: exercise.id,
          setNumber: 1,
          repetitions: 1,
          loadKg: null,
          loadText: null,
          rir: null,
          completed: false,
          painResponse: 'SEVERE',
          techniqueOk: false,
          adaptationReasonCodes: adaptation.reasonCodes,
        },
      ],
      feedback: {
        completionStatus: 'STOPPED',
        sessionRpe: 6,
        difficulty: 'TOO_HARD',
        pain: 'SEVERE',
        painLocation: 'Testikipu',
        felt: 'WORSE',
        notes: '',
        stopReason: 'PAIN',
      },
    })

    expect(data.latest('workouts')?.data.status).toBe('CANCELLED')
    expect(data.latest('workout_logs')?.data).toMatchObject({
      completion_status: 'STOPPED',
      decision_trace: { safetyOutcome: 'STOP' },
    })
    expect(data.latest('exercise_set_logs')?.data.data).toMatchObject({
      pain_response: 'SEVERE',
      technique_ok: false,
      adaptation_reason_codes: ['SEVERE_PAIN_REPORTED'],
    })
    expect(canResumeWorkout('SEVERE_PAIN_REPORTED')).toBe(false)
  })
})
