import { describe, expect, it } from 'vitest'
import {
  adaptNextSet,
  createResistanceSessionObjective,
  decideInterSessionProgression,
  estimateAdultResistanceCapability,
  filterEligibleExercises,
  generatePlan,
  prescribeAdultResistanceSession,
  prescribeResistanceDose,
  resolvePrescription,
  publishedExerciseCatalog,
  type AdultResistanceAthleteContext,
  type AdultResistanceSetHistory,
  type VerifiedNextLoad,
} from '.'

const generatedAt = '2026-08-25T12:00:00.000Z'
const dumbbellLoadContext = 'adult-resistance-load-context-1.0.0:dumbbell-kg-each'
const externalLoadContext = 'adult-resistance-load-context-1.0.0:external-kg'

function successfulSet(
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
    rir: 2,
    completedAt: '2026-08-20T10:00:00.000Z',
    pain: false,
    techniqueOk: true,
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    ...overrides,
  }
}

function verifiedNextLoad(
  currentLoadKg = 40,
  nextAvailableLoadKg = 42.5,
  overrides: Partial<VerifiedNextLoad> = {},
): VerifiedNextLoad {
  return {
    exerciseCode: 'TEST_LIFT',
    exerciseVersion: '1.0.0',
    loadContextId: externalLoadContext,
    currentLoadKg,
    nextAvailableLoadKg,
    confirmedAt: '2026-08-25T09:00:00.000Z',
    policyVersion: 'verified-next-load-1.0.0',
    ...overrides,
  }
}

function context(
  overrides: Partial<AdultResistanceAthleteContext> = {},
): AdultResistanceAthleteContext {
  return {
    age: 35,
    contentReleaseId: 'adult-resistance-v1.0.0',
    ruleVersion: 'adult-resistance-rules-1.0.0',
    experience: 'BEGINNER',
    goal: 'GENERAL_FITNESS',
    equipment: ['Kehonpaino', 'Käsipainot'],
    environment: 'HOME',
    availableMinutes: 30,
    generatedAt,
    physicalLoad: 'MODERATE',
    readiness: 'GREEN',
    limitationTags: [],
    dislikedExerciseCodes: [],
    likedExerciseCodes: [],
    supervisionAvailable: false,
    ...overrides,
  }
}

describe('AdultResistanceEngine', () => {
  it('on täysin deterministinen samalla ajalla ja sisältöjulkaisulla', () => {
    const input = { sessionId: 'same', title: 'Kokovartalon voima', context: context() }
    expect(prescribeAdultResistanceSession(input)).toEqual(
      prescribeAdultResistanceSession(input),
    )
  })

  it('muodostaa aloittelijalle kotona konservatiivisen kalibroivan harjoituksen', () => {
    const result = prescribeAdultResistanceSession({
      sessionId: 'home',
      title: 'Kotivoima',
      context: context(),
    })
    expect(result.durationMinutes).toBeLessThanOrEqual(30)
    expect(result.exercises.length).toBeGreaterThanOrEqual(3)
    expect(
      result.exercises.every((exercise) =>
        exercise.equipment.some((item) => ['Kehonpaino', 'Käsipainot'].includes(item)),
      ),
    ).toBe(true)
    expect(result.exercises.every((exercise) => exercise.difficulty === 'BEGINNER')).toBe(
      true,
    )
    expect(result.exercises.every((exercise) => (exercise.targetRir ?? 0) >= 3)).toBe(
      true,
    )
    expect(
      result.decisionTrace.capabilityEstimates?.every((item) => item.calibrationRequired),
    ).toBe(true)
    expect(
      result.exercises.every((exercise) => !/\d+–\d+ kg/u.test(exercise.loadGuidance)),
    ).toBe(true)
  })

  it('käyttää keskitasoisen salikäyttäjän kuorma-, toisto- ja RIR-historiaa', () => {
    const exercise = publishedExerciseCatalog.getExercise('GOBLET_SQUAT')!
    const history: AdultResistanceSetHistory[] = [
      successfulSet({
        sessionId: 'goblet-1',
        exerciseCode: 'GOBLET_SQUAT',
        exerciseVersion: exercise.version,
        loadKg: 30,
        loadType: 'DUMBBELL_KG_EACH',
        loadContextId: dumbbellLoadContext,
        repetitions: 8,
        rir: 2,
        completedAt: '2026-08-10T10:00:00.000Z',
      }),
      successfulSet({
        sessionId: 'goblet-2',
        exerciseCode: 'GOBLET_SQUAT',
        exerciseVersion: exercise.version,
        loadKg: 32,
        loadType: 'DUMBBELL_KG_EACH',
        loadContextId: dumbbellLoadContext,
        repetitions: 8,
        rir: 2,
        completedAt: '2026-08-17T10:00:00.000Z',
      }),
      successfulSet({
        sessionId: 'goblet-3',
        exerciseCode: 'GOBLET_SQUAT',
        exerciseVersion: exercise.version,
        loadKg: 32,
        loadType: 'DUMBBELL_KG_EACH',
        loadContextId: dumbbellLoadContext,
        repetitions: 9,
        rir: 2,
        completedAt: '2026-08-24T10:00:00.000Z',
      }),
    ]
    const athlete = context({
      experience: 'INTERMEDIATE',
      goal: 'MAX_STRENGTH',
      equipment: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet', 'Levytanko ja painot'],
      environment: 'GYM',
      availableMinutes: 60,
    })
    const estimate = estimateAdultResistanceCapability(
      exercise,
      history,
      generatedAt,
      'INTERMEDIATE',
    )
    const dose = prescribeResistanceDose(
      createResistanceSessionObjective(athlete),
      exercise,
      estimate,
      athlete,
      { comparableSetsThisWeek: 0 },
    )
    expect(estimate.confidence).toBe('MODERATE')
    expect(estimate.estimated1RmKg).toBeGreaterThan(32)
    expect(estimate.workingLoadRangeKg).toBeDefined()
    expect(dose.prescribedLoadRangeKg).toEqual(estimate.workingLoadRangeKg)
    expect(dose.targetRir).toEqual([2, 3])
  })

  it('käyttää liikeperheen historiaa vain epävarmuuskontekstina eikä teeskentele tarkkaa kuormaa', () => {
    const exercise = publishedExerciseCatalog.getExercise('GOBLET_SQUAT')!
    const estimate = estimateAdultResistanceCapability(
      exercise,
      [
        {
          exerciseCode: 'CHAIR_SQUAT',
          movementPatterns: ['SQUAT'],
          loadKg: null,
          repetitions: 12,
          rir: 3,
          completedAt: '2026-08-20T10:00:00.000Z',
        },
        {
          exerciseCode: 'CHAIR_SQUAT',
          movementPatterns: ['SQUAT'],
          loadKg: null,
          repetitions: 13,
          rir: 3,
          completedAt: '2026-08-24T10:00:00.000Z',
        },
      ],
      generatedAt,
      'BEGINNER',
    )

    expect(estimate).toMatchObject({
      confidence: 'LOW',
      calibrationRequired: true,
      supportingSetCount: 2,
    })
    expect(estimate.workingLoadRangeKg).toBeUndefined()
    expect(estimate.reasons).toContain('MOVEMENT_FAMILY_HISTORY_USED_AS_CONTEXT_ONLY')
  })

  it('ei muunna kehonpainoa tai vastuskuminauhaa kilogramma-arvioksi', () => {
    for (const code of ['BODYWEIGHT_SQUAT', 'BAND_ROW']) {
      const exercise = publishedExerciseCatalog.getExercise(code)!
      const estimate = estimateAdultResistanceCapability(
        exercise,
        [
          {
            exerciseCode: code,
            loadKg: 20,
            repetitions: 10,
            rir: 2,
            completedAt: '2026-08-24T10:00:00.000Z',
          },
          {
            exerciseCode: code,
            loadKg: 22,
            repetitions: 10,
            rir: 2,
            completedAt: '2026-08-25T10:00:00.000Z',
          },
        ],
        generatedAt,
        'INTERMEDIATE',
      )
      expect(estimate).toMatchObject({ confidence: 'LOW', calibrationRequired: true })
      expect(estimate.estimated1RmKg).toBeUndefined()
      expect(estimate.reasons).toContain('LOAD_TYPE_NOT_COMPARABLE_IN_KILOGRAMS')
    }
  })

  it('ei päättele tarkkaa kuormaa hyvin korkeista toistoista tai vanhasta datasta', () => {
    const exercise = publishedExerciseCatalog.getExercise('GOBLET_SQUAT')!
    const highRepHistory: AdultResistanceSetHistory[] = [1, 2].map((offset) => ({
      exerciseCode: 'GOBLET_SQUAT',
      loadKg: 10 + offset,
      repetitions: 30,
      rir: 2,
      completedAt: `2026-08-2${offset}T10:00:00.000Z`,
    }))
    expect(
      estimateAdultResistanceCapability(
        exercise,
        highRepHistory,
        generatedAt,
        'INTERMEDIATE',
      ).calibrationRequired,
    ).toBe(true)

    const oldHistory: AdultResistanceSetHistory[] = [1, 2].map((offset) => ({
      exerciseCode: 'GOBLET_SQUAT',
      loadKg: 30,
      repetitions: 8,
      rir: 2,
      completedAt: `2026-01-0${offset}T10:00:00.000Z`,
    }))
    const oldEstimate = estimateAdultResistanceCapability(
      exercise,
      oldHistory,
      generatedAt,
      'INTERMEDIATE',
    )
    expect(oldEstimate).toMatchObject({ confidence: 'LOW', calibrationRequired: true })
    expect(oldEstimate.estimated1RmKg).toBeUndefined()
  })

  it('keventää sarjamäärää, kun saman liikeperheen tuore viikkovolyymi on korkea', () => {
    const exercise = publishedExerciseCatalog.getExercise('GOBLET_SQUAT')!
    const athlete = context({ experience: 'INTERMEDIATE', availableMinutes: 60 })
    const objective = createResistanceSessionObjective(athlete)
    const capability = estimateAdultResistanceCapability(
      exercise,
      [],
      generatedAt,
      'INTERMEDIATE',
    )

    expect(
      prescribeResistanceDose(objective, exercise, capability, athlete, {
        comparableSetsThisWeek: 12,
      }).sets,
    ).toBeLessThan(
      prescribeResistanceDose(objective, exercise, capability, athlete, {
        comparableSetsThisWeek: 0,
      }).sets,
    )
  })

  it('hylkää puuttuvan välineen, kivun ja eksplisiittisen inhokin ennen pisteytystä', () => {
    const athlete = context({
      limitationTags: ['ACUTE_KNEE_PAIN'],
      dislikedExerciseCodes: ['DUMBBELL_BENCH_PRESS'],
    })
    const decisions = filterEligibleExercises(
      publishedExerciseCatalog,
      athlete,
      createResistanceSessionObjective(athlete),
    )
    expect(
      decisions.find((item) => item.exercise.code === 'BARBELL_RDL')?.reasonCodes,
    ).toContain('EQUIPMENT_UNAVAILABLE')
    expect(
      decisions.find((item) => item.exercise.code === 'GOBLET_SQUAT')?.reasonCodes,
    ).toContain('CONTRAINDICATION_MATCH')
    expect(
      decisions.find((item) => item.exercise.code === 'DUMBBELL_BENCH_PRESS')
        ?.reasonCodes,
    ).toContain('EXPLICIT_DISLIKE')
  })

  it('säilyttää ensisijaisen adaptaation, kun 60 minuutin harjoitus rakennetaan 20 minuuttiin', () => {
    const full = prescribeAdultResistanceSession({
      sessionId: 'full',
      title: 'Voima',
      context: context({ availableMinutes: 60 }),
    })
    const compact = prescribeAdultResistanceSession({
      sessionId: 'compact',
      title: 'Voima',
      context: context({ availableMinutes: 20 }),
    })
    expect(compact.objective?.primaryAdaptation).toBe(full.objective?.primaryAdaptation)
    expect(compact.durationMinutes).toBeLessThanOrEqual(20)
    expect(compact.exercises.length).toBeGreaterThanOrEqual(2)
    expect(compact.exercises.map((item) => item.code)).not.toEqual(
      full.exercises.slice(0, compact.exercises.length).map((item) => item.code),
    )
    expect(
      compact.decisionTrace.rejectedExercises?.some((item) =>
        item.reasonCodes.includes('NOT_SELECTED_HIGHER_RANKED_CANDIDATE'),
      ),
    ).toBe(true)
  })

  it('mukauttaa liian raskaan sarjan vain yhden kuormaportaan verran', () => {
    expect(
      adaptNextSet({
        prescribedLoadKg: 40,
        prescribedRepetitions: 8,
        targetRir: [2, 3],
        completedLoadKg: 40,
        completedRepetitions: 7,
        completedRir: 0,
        pain: 'NONE',
        techniqueOk: true,
        experience: 'INTERMEDIATE',
        loadIncrementKg: 2.5,
      }),
    ).toMatchObject({ action: 'DECREASE_ONE_INCREMENT', adjustedLoadKg: 37.5 })
  })

  it('progressio muuttaa oikeaa kuormaa vasta kahden vertailukelpoisen onnistumisen jälkeen', () => {
    expect(
      decideInterSessionProgression({
        comparableSessions: [successfulSet()],
        targetRir: [2, 3],
        verifiedNextLoads: [verifiedNextLoad()],
        targetExerciseCode: 'TEST_LIFT',
        targetExerciseVersion: '1.0.0',
        targetLoadType: 'EXTERNAL_KG',
        targetLoadContextId: externalLoadContext,
        maximumRepetitions: 8,
        generatedAt,
      }).action,
    ).toBe('KEEP_LOAD')
    expect(
      decideInterSessionProgression({
        comparableSessions: [
          successfulSet({ sessionId: 'workout-1' }),
          successfulSet({
            sessionId: 'workout-2',
            completedAt: '2026-08-24T10:00:00.000Z',
          }),
        ],
        targetRir: [2, 3],
        verifiedNextLoads: [verifiedNextLoad()],
        targetExerciseCode: 'TEST_LIFT',
        targetExerciseVersion: '1.0.0',
        targetLoadType: 'EXTERNAL_KG',
        targetLoadContextId: externalLoadContext,
        maximumRepetitions: 8,
        generatedAt,
      }),
    ).toMatchObject({
      action: 'INCREASE_LOAD',
      nextLoadKg: 42.5,
      changedVariable: 'LOAD',
    })
  })

  it('estää todellisenkin painoportaan, jos automaattinen lisäys ylittää kymmenen prosenttia', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulSet({ sessionId: 'workout-1', loadKg: 5, repetitions: 10 }),
        successfulSet({
          sessionId: 'workout-2',
          loadKg: 5,
          repetitions: 10,
          completedAt: '2026-08-24T10:00:00.000Z',
        }),
      ],
      targetRir: [2, 3],
      verifiedNextLoads: [verifiedNextLoad(5, 6)],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      maximumRepetitions: 10,
      generatedAt,
    })
    expect(decision).toMatchObject({
      action: 'KEEP_LOAD',
      changedVariable: 'NONE',
    })
    expect(decision.nextLoadKg).toBe(5)
    expect(decision.reasonCodes).toContain('VERIFIED_NEXT_LOAD_EXCEEDS_TEN_PERCENT')
  })

  it('sallii täsmälleen kymmenen prosentin vahvistetun kuorman', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulSet({ sessionId: 'workout-1', loadKg: 20 }),
        successfulSet({
          sessionId: 'workout-2',
          loadKg: 20,
          completedAt: '2026-08-24T10:00:00.000Z',
        }),
      ],
      targetRir: [2, 3],
      verifiedNextLoads: [verifiedNextLoad(20, 22)],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      maximumRepetitions: 8,
      generatedAt,
    })

    expect(decision).toMatchObject({ action: 'INCREASE_LOAD', nextLoadKg: 22 })
  })

  it('ei valtuuta kuormannostoa legacy-historian loadIncrementKg-arvolla', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulSet({ sessionId: 'workout-1', loadIncrementKg: 2.5 }),
        successfulSet({
          sessionId: 'workout-2',
          loadIncrementKg: 2.5,
          completedAt: '2026-08-24T10:00:00.000Z',
        }),
      ],
      targetRir: [2, 3],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      maximumRepetitions: 8,
      generatedAt,
    })
    expect(decision).toMatchObject({
      action: 'KEEP_LOAD',
      currentLoadKg: 40,
      nextLoadKg: 40,
    })
    expect(decision.reasonCodes).toContain('NEXT_AVAILABLE_LOAD_NOT_CONFIRMED')
  })

  it.each([
    { label: 'poistettu vahvistus', confirmations: [] },
    {
      label: 'uusinta tukiharjoitusta vanhempi vahvistus',
      confirmations: [
        verifiedNextLoad(40, 42.5, {
          confirmedAt: '2026-08-24T09:59:59.000Z',
        }),
      ],
    },
    {
      label: 'väärä politiikkaversio',
      confirmations: [
        verifiedNextLoad(40, 42.5, {
          policyVersion: 'verified-next-load-0.9.0',
        }),
      ],
    },
  ])(
    '$label ei valtuuta kuormannostoa mutta ei estä harjoittelua',
    ({ confirmations }) => {
      const decision = decideInterSessionProgression({
        comparableSessions: [
          successfulSet({ sessionId: 'workout-1' }),
          successfulSet({
            sessionId: 'workout-2',
            completedAt: '2026-08-24T10:00:00.000Z',
          }),
        ],
        targetRir: [2, 3],
        verifiedNextLoads: confirmations,
        targetExerciseCode: 'TEST_LIFT',
        targetExerciseVersion: '1.0.0',
        targetLoadType: 'EXTERNAL_KG',
        targetLoadContextId: externalLoadContext,
        maximumRepetitions: 8,
        generatedAt,
      })

      expect(decision).toMatchObject({
        action: 'KEEP_LOAD',
        currentLoadKg: 40,
        nextLoadKg: 40,
        changedVariable: 'NONE',
      })
      expect(decision.reasonCodes).toContain('NEXT_AVAILABLE_LOAD_NOT_CONFIRMED')
    },
  )

  it.each([
    {
      label: 'eri liikeversio',
      confirmation: verifiedNextLoad(40, 42.5, { exerciseVersion: '2.0.0' }),
    },
    {
      label: 'eri kuormakonteksti',
      confirmation: verifiedNextLoad(40, 42.5, {
        loadContextId: dumbbellLoadContext,
      }),
    },
  ])('ei peri vahvistusta, kun $label vaihtuu', ({ confirmation }) => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulSet({ sessionId: 'workout-1' }),
        successfulSet({
          sessionId: 'workout-2',
          completedAt: '2026-08-24T10:00:00.000Z',
        }),
      ],
      targetRir: [2, 3],
      verifiedNextLoads: [confirmation],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      maximumRepetitions: 8,
      generatedAt,
    })

    expect(decision.action).toBe('KEEP_LOAD')
    expect(decision.reasonCodes).toContain('NEXT_AVAILABLE_LOAD_NOT_CONFIRMED')
  })

  it('laskee saman WorkoutRecordin monta sarjaa vain yhdeksi exposureksi', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulSet({ sessionId: 'same-workout' }),
        successfulSet({ sessionId: 'same-workout', repetitions: 8 }),
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

  it('vaatii legacy-historialta sessionId:n ennen tarkkaa kilogrammapäätöstä', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [successfulSet({ sessionId: undefined })],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      targetRir: [2, 3],
      maximumRepetitions: 8,
      loadIncrementKg: 2.5,
      generatedAt,
    })

    expect(decision).toMatchObject({
      action: 'RECALIBRATE_LOAD',
      supportingSessionIds: [],
    })
    expect(decision.reasonCodes).toContain('SESSION_IDENTITY_REQUIRED')
  })

  it('ei anna koneelle täsmällistä kilogramma-arviota ilman laitekontekstia', () => {
    const exercise = publishedExerciseCatalog.getExercise('LEG_PRESS')!
    const estimate = estimateAdultResistanceCapability(
      exercise,
      [
        successfulSet({
          sessionId: 'machine-1',
          exerciseCode: exercise.code,
          exerciseVersion: exercise.version,
          loadType: 'MACHINE_KG',
          loadContextId: undefined,
        }),
        successfulSet({
          sessionId: 'machine-2',
          exerciseCode: exercise.code,
          exerciseVersion: exercise.version,
          loadType: 'MACHINE_KG',
          loadContextId: undefined,
        }),
      ],
      generatedAt,
      'INTERMEDIATE',
    )

    expect(estimate.calibrationRequired).toBe(true)
    expect(estimate.workingLoadRangeKg).toBeUndefined()
    expect(estimate.reasons).toContain('COMPARABLE_LOAD_CONTEXT_REQUIRED')
  })

  it.each([
    ['BEGINNER', [6, 10]],
    ['INTERMEDIATE', [5, 8]],
    ['ADVANCED', [4, 6]],
  ] as const)(
    'antaa MAX_STRENGTH-käyttäjälle cold start -säännön mukaisen alueen (%s)',
    (experience, expected) => {
      const exercise = publishedExerciseCatalog.getExercise('GOBLET_SQUAT')!
      const athlete = context({ experience, goal: 'MAX_STRENGTH' })
      const reliableHistory =
        experience === 'BEGINNER'
          ? []
          : [
              successfulSet({
                sessionId: 'goblet-1',
                exerciseCode: exercise.code,
                exerciseVersion: exercise.version,
                loadType: 'DUMBBELL_KG_EACH',
                loadContextId: dumbbellLoadContext,
              }),
              successfulSet({
                sessionId: 'goblet-2',
                exerciseCode: exercise.code,
                exerciseVersion: exercise.version,
                loadType: 'DUMBBELL_KG_EACH',
                loadContextId: dumbbellLoadContext,
                completedAt: '2026-08-24T10:00:00.000Z',
              }),
            ]
      const capability = estimateAdultResistanceCapability(
        exercise,
        reliableHistory,
        generatedAt,
        experience,
      )
      const dose = prescribeResistanceDose(
        createResistanceSessionObjective(athlete),
        exercise,
        capability,
        athlete,
        { comparableSetsThisWeek: 0 },
      )

      expect(dose.repetitions).toEqual(expected)
      if (experience === 'BEGINNER') expect(capability.calibrationRequired).toBe(true)
      else expect(capability.supportingSessionCount).toBe(2)
    },
  )

  it('lisää yhden toiston yhden onnistuneen erillisen harjoituksen jälkeen', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [successfulSet({ repetitions: 7 })],
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      targetRir: [2, 3],
      maximumRepetitions: 8,
      loadIncrementKg: 2.5,
      generatedAt,
    })

    expect(decision).toMatchObject({
      action: 'INCREASE_REPETITIONS',
      nextLoadKg: 40,
      nextRepetitions: 8,
      supportingSessionIds: ['workout-1'],
    })
  })

  it.each([
    { patch: { pain: true }, label: 'kipu' },
    { patch: { techniqueOk: false }, label: 'tekniikkavirhe' },
    {
      patch: { completionStatus: 'STOPPED' as const, doseCompleted: false },
      label: 'keskeytys',
    },
  ])('katkaisee onnistumisjakson: $label', ({ patch }) => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        successfulSet({ sessionId: 'workout-1' }),
        successfulSet({
          sessionId: 'workout-2',
          completedAt: '2026-08-22T10:00:00.000Z',
        }),
        successfulSet({
          sessionId: 'workout-3',
          completedAt: '2026-08-24T10:00:00.000Z',
          ...patch,
        }),
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
    expect(decision.reasonCodes).toContain('SUCCESS_STREAK_BROKEN')
    expect(decision.supportingSessionIds).toEqual(['workout-3'])
  })

  it.each(['BODYWEIGHT', 'BAND'] as const)(
    'ei muodosta %s-liikkeelle kilogrammaprogressiota',
    (targetLoadType) => {
      const decision = decideInterSessionProgression({
        comparableSessions: [
          successfulSet({ loadKg: null, loadType: targetLoadType, repetitions: 7 }),
        ],
        targetExerciseCode: 'TEST_LIFT',
        targetExerciseVersion: '1.0.0',
        targetLoadType,
        targetRir: [2, 3],
        maximumRepetitions: 8,
        generatedAt,
      })
      expect(decision.action).toBe('INCREASE_REPETITIONS')
      expect(decision.nextLoadKg).toBeUndefined()
    },
  )

  it('kytkee progression resolvePrescription- ja PlanGenerator-tuotantopolkuun', () => {
    const profile = {
      goal: 'MAX_STRENGTH' as const,
      experience: 'INTERMEDIATE' as const,
      equipment: ['Käsipainot'],
      physicalLoad: 'MODERATE' as const,
      minutesPerSession: 45,
      age: 35,
      generatedAt,
      readiness: 'GREEN' as const,
    }
    const baseline = resolvePrescription({
      sessionId: 'production-baseline',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile,
    })
    if (baseline.status !== 'SUPPORTED') throw new Error(baseline.reasonCode)
    const exercise = baseline.prescription.exercises.find(
      (item) => item.loadContextId !== undefined,
    )!
    const upper = Number(exercise.repetitions?.match(/\d+$/u)?.[0] ?? 10)
    const history = [
      successfulSet({
        sessionId: 'production-workout-1',
        exerciseCode: exercise.code,
        exerciseVersion: exercise.contentVersion,
        loadType: exercise.loadType,
        loadContextId: exercise.loadContextId,
        repetitions: upper - 1,
        rir: exercise.targetRir,
      }),
    ]
    const resolved = resolvePrescription({
      sessionId: 'production-next',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: { ...profile, strengthHistory: history },
    })
    if (resolved.status !== 'SUPPORTED') throw new Error(resolved.reasonCode)
    const resolvedExercise = resolved.prescription.exercises.find(
      (item) => item.code === exercise.code,
    )!
    expect(resolvedExercise.progressionDecision).toMatchObject({
      action: 'INCREASE_REPETITIONS',
      nextRepetitions: upper,
      supportingSessionIds: ['production-workout-1'],
    })
    expect(resolvedExercise.loadGuidance).toContain('lisää yksi toisto')
    expect(resolved.prescription.decisionTrace.adaptations).toContainEqual(
      expect.objectContaining({
        original: expect.objectContaining({
          supportingSessionIds: ['production-workout-1'],
        }),
        reasonCodes: expect.arrayContaining(['ONE_SUCCESSFUL_DISTINCT_SESSION']),
      }),
    )

    const plan = generatePlan({
      weekAnchorDate: '2026-08-24',
      calendarTimeZone: 'Europe/Helsinki',
      localDate: '2026-08-25',
      goal: { primary: 'MAX_STRENGTH', secondary: [], inputs: {} },
      experience: 'INTERMEDIATE',
      availableDays: [1, 3, 5],
      currentEnduranceMinutes: 0,
      fixedSessions: [],
      competitions: [],
      equipment: ['Käsipainot'],
      minutesPerSession: 45,
      age: 35,
      generatedAt,
      strengthHistory: history,
    })
    const plannedExercise = plan.decision.sessions
      .find((session) => session.kind === 'STRENGTH')
      ?.prescriptionDetail?.exercises.find((item) => item.code === exercise.code)
    expect(plannedExercise?.progressionDecision?.supportingSessionIds).toEqual([
      'production-workout-1',
    ])

    const loadProgression = resolvePrescription({
      sessionId: 'production-load-progression',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: {
        ...profile,
        strengthHistory: [
          successfulSet({
            sessionId: 'production-workout-1',
            exerciseCode: exercise.code,
            exerciseVersion: exercise.contentVersion,
            loadType: exercise.loadType,
            loadContextId: exercise.loadContextId,
            repetitions: upper,
            rir: exercise.targetRir,
          }),
          successfulSet({
            sessionId: 'production-workout-2',
            exerciseCode: exercise.code,
            exerciseVersion: exercise.contentVersion,
            loadType: exercise.loadType,
            loadContextId: exercise.loadContextId,
            repetitions: upper,
            rir: exercise.targetRir,
            completedAt: '2026-08-24T10:00:00.000Z',
          }),
        ],
        verifiedNextLoads: [
          verifiedNextLoad(40, 42.5, {
            exerciseCode: exercise.code,
            exerciseVersion: exercise.contentVersion,
            loadContextId: exercise.loadContextId,
          }),
        ],
      },
    })
    if (loadProgression.status !== 'SUPPORTED')
      throw new Error(loadProgression.reasonCode)
    const loadExercise = loadProgression.prescription.exercises.find(
      (item) => item.code === exercise.code,
    )!
    expect(loadExercise.progressionDecision).toMatchObject({
      action: 'INCREASE_LOAD',
      nextLoadKg: 42.5,
      supportingSessionIds: ['production-workout-1', 'production-workout-2'],
    })
    expect(loadExercise.loadGuidance).toContain(
      'nosta kuorma vahvistettuun seuraavaan portaaseen',
    )
  })
})

describe('Prescription-tuen rajat', () => {
  const profile = {
    goal: 'GENERAL_FITNESS' as const,
    experience: 'BEGINNER' as const,
    equipment: ['Kehonpaino'],
    physicalLoad: 'MODERATE' as const,
    minutesPerSession: 30,
    generatedAt,
    readiness: 'GREEN' as const,
  }

  it('ei anna 17-vuotiaalle aikuisten prescriptionia', () => {
    expect(
      resolvePrescription({
        sessionId: 'minor',
        title: 'Voima',
        kind: 'STRENGTH',
        durationMinutes: 30,
        profile: { ...profile, age: 17 },
      }),
    ).toMatchObject({ status: 'UNSUPPORTED', reasonCode: 'YOUTH_ENGINE_NOT_AVAILABLE' })
  })

  it.each(['SPORT', 'MATCH', 'SPEED_POWER'] as const)(
    '%s ei muutu voimaksi tai liikkuvuudeksi',
    (kind) => {
      expect(
        resolvePrescription({
          sessionId: kind,
          title: kind,
          kind,
          durationMinutes: 45,
          profile: { ...profile, age: 30 },
        }),
      ).toMatchObject({ status: 'UNSUPPORTED', sessionKind: kind })
    },
  )
})
