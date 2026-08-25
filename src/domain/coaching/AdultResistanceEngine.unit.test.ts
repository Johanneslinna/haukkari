import { describe, expect, it } from 'vitest'
import {
  adaptNextSet,
  createResistanceSessionObjective,
  decideInterSessionProgression,
  estimateAdultResistanceCapability,
  filterEligibleExercises,
  prescribeAdultResistanceSession,
  prescribeResistanceDose,
  resolvePrescription,
  publishedExerciseCatalog,
  type AdultResistanceAthleteContext,
  type AdultResistanceSetHistory,
} from '.'

const generatedAt = '2026-08-25T12:00:00.000Z'

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
      {
        exerciseCode: 'GOBLET_SQUAT',
        loadKg: 30,
        repetitions: 8,
        rir: 2,
        completedAt: '2026-08-10T10:00:00.000Z',
      },
      {
        exerciseCode: 'GOBLET_SQUAT',
        loadKg: 32,
        repetitions: 8,
        rir: 2,
        completedAt: '2026-08-17T10:00:00.000Z',
      },
      {
        exerciseCode: 'GOBLET_SQUAT',
        loadKg: 32,
        repetitions: 9,
        rir: 2,
        completedAt: '2026-08-24T10:00:00.000Z',
      },
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
        comparableSessions: [
          { loadKg: 40, repetitions: 8, rir: 2, pain: false, techniqueOk: true },
        ],
        targetRir: [2, 3],
        loadIncrementKg: 2.5,
      }).action,
    ).toBe('MAINTAIN_AND_COLLECT_MORE_DATA')
    expect(
      decideInterSessionProgression({
        comparableSessions: [
          { loadKg: 40, repetitions: 8, rir: 2, pain: false, techniqueOk: true },
          { loadKg: 40, repetitions: 8, rir: 2, pain: false, techniqueOk: true },
        ],
        targetRir: [2, 3],
        loadIncrementKg: 2.5,
      }),
    ).toMatchObject({
      action: 'INCREASE_LOAD',
      nextLoadKg: 42.5,
      changedVariable: 'LOAD',
    })
  })

  it('sallii pienimmän todellisen painoportaan yli viiden prosentin vain onnistuneen progression jälkeen', () => {
    const decision = decideInterSessionProgression({
      comparableSessions: [
        { loadKg: 5, repetitions: 10, rir: 2, pain: false, techniqueOk: true },
        { loadKg: 5, repetitions: 10, rir: 2, pain: false, techniqueOk: true },
      ],
      targetRir: [2, 3],
      loadIncrementKg: 1,
    })
    expect(decision).toMatchObject({ action: 'INCREASE_LOAD', nextLoadKg: 6 })
    expect(decision.reasonCodes).toContain('MINIMUM_AVAILABLE_INCREMENT_EXCEPTION')
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
