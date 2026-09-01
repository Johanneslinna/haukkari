import { describe, expect, it } from 'vitest'
import { createLocalCalendarContext } from './LocalCalendarPolicy'
import { generatePlan, type PlanGenerationInput } from './PlanGenerator'
import {
  MAX_ROLLING_MUSCLE_SETS,
  MAX_SESSION_PRIMARY_MUSCLE_SETS,
  calculatePlannedMuscleVolume,
  calculateSessionPrimaryMuscleVolume,
} from './StrengthVolumePolicy'
import {
  STRENGTH_WEEK_POLICY_VERSION,
  STRENGTH_WEEK_REASON_CODES,
  createStrengthWeekBlueprint,
  finalizeStrengthWeekPlan,
  initialStrengthWeekMaterializationState,
  maximumWeeklySetProgression,
  strengthGoalRange,
} from './StrengthWeekPolicy'
import { auditStrengthPrescriptionTime } from './TimeBudgetPolicy'
import type { AdultResistanceSetHistory } from './AdultResistanceEngine'

const generatedAt = '2026-08-27T08:00:00.000Z'

function successfulHistory(
  overrides: Partial<AdultResistanceSetHistory> = {},
): AdultResistanceSetHistory {
  return {
    sessionId: 'history-1',
    exerciseCode: 'GOBLET_SQUAT',
    exerciseVersion: '1.0.0',
    movementPatterns: ['SQUAT'],
    primaryMuscles: ['quadriceps', 'gluteals'],
    secondaryMuscles: ['trunk'],
    loadKg: 20,
    loadType: 'DUMBBELL_KG_EACH',
    loadContextId:
      'adult-resistance-load-context-1.0.0:GOBLET_SQUAT:1.0.0:DUMBBELL_KG_EACH',
    repetitions: 8,
    rir: 2,
    targetRirMin: 2,
    targetRirMax: 3,
    completedAt: '2026-08-26T08:00:00.000Z',
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    pain: false,
    techniqueOk: true,
    stopped: false,
    severeRecoveryProblem: false,
    ...overrides,
  }
}

function continuityHistory() {
  return [
    '2026-08-22',
    '2026-08-15',
    '2026-08-08',
    '2026-08-01',
    '2026-07-25',
    '2026-07-18',
    '2026-07-11',
    '2026-07-04',
    '2026-06-27',
    '2026-06-20',
    '2026-06-13',
    '2026-06-06',
    '2026-05-29',
  ].map((date, index) =>
    successfulHistory({
      sessionId: `continuity-${index}`,
      exerciseCode: `LEGACY_CONTINUITY_${index}`,
      exerciseVersion: 'snapshot-1',
      primaryMuscles: ['trunk'],
      secondaryMuscles: [],
      completedAt: `${date}T08:00:00.000Z`,
    }),
  )
}

function input(overrides: Partial<PlanGenerationInput> = {}): PlanGenerationInput {
  const clock = createLocalCalendarContext(
    overrides.generatedAt ?? generatedAt,
    overrides.calendarTimeZone ?? 'Europe/Helsinki',
  )
  return {
    goal: { primary: 'MUSCLE_GAIN', secondary: [], inputs: {} },
    experience: 'INTERMEDIATE',
    availableDays: [1, 2, 4, 6],
    currentEnduranceMinutes: 0,
    fixedSessions: [],
    competitions: [],
    equipment: ['Kehonpaino', 'Käsipainot', 'Vastuskuminauhat'],
    physicalLoad: 'MODERATE',
    minutesPerSession: 45,
    minutesByDay: { '1': 45, '2': 45, '4': 45, '6': 45 },
    age: 35,
    generatedAt: clock.generatedAt,
    calendarTimeZone: clock.calendarTimeZone,
    localDate: clock.localDate,
    weekAnchorDate: clock.weekAnchorDate,
    strengthHistory: [successfulHistory()],
    strengthTrainingBackground: {
      regularTrainingAtLeast12Weeks: true,
      lastStrengthWorkoutAt: '2026-08-26T08:00:00.000Z',
      source: 'USER_CONFIRMED',
      confirmedAt: '2026-08-27T07:00:00.000Z',
      policyVersion: 'adult-strength-return-1.0.0',
    },
    ...overrides,
  }
}

function strengthSessions(planInput: PlanGenerationInput) {
  return generatePlan(planInput).decision.sessions.filter(
    (session) => session.source === 'APP' && session.kind === 'STRENGTH',
  )
}

function unrestrictedFourDayPlan() {
  return generatePlan(
    input({
      experience: 'ADVANCED',
      availableDays: [1, 3, 5, 7],
      minutesPerSession: 90,
      minutesByDay: { '1': 90, '3': 90, '5': 90, '7': 90 },
      equipment: [
        'Kehonpaino',
        'Käsipainot',
        'Levytanko ja painot',
        'Kahvakuula',
        'Vastuskuminauhat',
        'Kuntosalilaitteet',
        'Juoksumatto',
        'Polkupyörä, kuntopyörä tai pyörätraineri',
      ],
    }),
  ).decision
}

describe('adult-strength-week-1.0.0', () => {
  it('käyttää kylmäaloituksessa konservatiivista 4–8 sarjan tavoitetta ja kahta harjoitusta', () => {
    expect(strengthGoalRange('MUSCLE_GAIN', false)).toEqual({
      minimumSetsPerMuscle: 4,
      targetSetsPerMuscle: 8,
    })
    expect(strengthGoalRange('MUSCLE_GAIN', true)).toEqual({
      minimumSetsPerMuscle: 8,
      targetSetsPerMuscle: 12,
    })
    expect(
      strengthSessions(
        input({
          strengthHistory: [],
          strengthTrainingBackground: undefined,
          availableDays: [1, 2, 4, 6],
        }),
      ),
    ).toHaveLength(2)
  })

  it('rajaa sarjaprogression alle kymmenessä yhteen ja sen jälkeen minimiin 2 tai 20 prosenttia', () => {
    expect(maximumWeeklySetProgression(9)).toBe(1)
    expect(maximumWeeklySetProgression(10)).toBe(2)
    expect(maximumWeeklySetProgression(16)).toBe(2)
    expect(maximumWeeklySetProgression(Number.NaN)).toBe(0)
  })

  it('muodostaa kahdelle päivälle aidosti erilaiset FULL_BODY_A/B-rungot', () => {
    const sessions = strengthSessions(input({ availableDays: [1, 4] }))
    expect(sessions.map((session) => session.strengthWeekContext?.role)).toEqual([
      'FULL_BODY_A',
      'FULL_BODY_B',
    ])
    expect(
      sessions[0]?.prescriptionDetail?.exercises.map((item) => item.code),
    ).not.toEqual(sessions[1]?.prescriptionDetail?.exercises.map((item) => item.code))
  })

  it('muodostaa kolmelle päivälle A/B/C-kierron', () => {
    const sessions = strengthSessions(input({ availableDays: [1, 3, 5] }))
    expect(sessions.map((session) => session.strengthWeekContext?.role)).toEqual([
      'FULL_BODY_A',
      'FULL_BODY_B',
      'FULL_BODY_C',
    ])
    expect(
      new Set(
        sessions.map((session) => session.prescriptionDetail?.exercises[0]?.category),
      ).size,
    ).toBeGreaterThan(1)
  })

  it('muodostaa neljälle aktiivisen kokeneen päivälle upper/lower-jaon', () => {
    const generated = unrestrictedFourDayPlan()
    const sessions = generated.sessions.filter(
      (session) => session.source === 'APP' && session.kind === 'STRENGTH',
    )
    expect(sessions.map((session) => session.strengthWeekContext?.role)).toEqual([
      'UPPER_A',
      'LOWER_A',
      'UPPER_B',
      'LOWER_B',
    ])
    const upperSessions = sessions.filter((session) =>
      session.strengthWeekContext?.role.startsWith('UPPER_'),
    )
    const lowerSessions = sessions.filter((session) =>
      session.strengthWeekContext?.role.startsWith('LOWER_'),
    )
    expect(
      upperSessions.every((session) =>
        session.prescriptionDetail?.exercises.every(
          (exercise) =>
            exercise.category !== 'SQUAT' &&
            exercise.category !== 'HINGE' &&
            exercise.category !== 'SINGLE_LEG',
        ),
      ),
    ).toBe(true)
    expect(upperSessions.map((session) => session.title)).toEqual([
      'Ylävartalon voima A',
      'Ylävartalon voima B',
    ])
    expect(lowerSessions.map((session) => session.title)).toEqual([
      'Alavartalon voima A',
      'Alavartalon voima B',
    ])
    expect(
      upperSessions.every(
        (session) => (session.prescriptionDetail?.exercises.length ?? 0) >= 5,
      ),
    ).toBe(true)
    expect(
      upperSessions.flatMap(
        (session) =>
          session.prescriptionDetail?.exercises.map((exercise) => exercise.category) ??
          [],
      ),
    ).toEqual(
      expect.arrayContaining([
        'HORIZONTAL_PUSH',
        'HORIZONTAL_PULL',
        'VERTICAL_PUSH',
        'VERTICAL_PULL',
      ]),
    )
    expect(
      upperSessions[0]?.prescriptionDetail?.exercises.map((exercise) => exercise.code),
    ).not.toEqual(
      upperSessions[1]?.prescriptionDetail?.exercises.map((exercise) => exercise.code),
    )
    for (const session of upperSessions) {
      const prescription = session.prescriptionDetail!
      expect(prescription.durationMinutes).toBeLessThanOrEqual(90)
      expect(prescription.durationMinutes).toBeLessThan(90)
      expect(auditStrengthPrescriptionTime(prescription).violations).toEqual([])
      expect(prescription.strengthRoleStructure).toMatchObject({
        status: 'COMPLETE',
        minimumExerciseCount: 5,
        targetExerciseCount: 5,
        actualExerciseCount: 5,
      })
    }
    expect(generated.strengthWeek).toMatchObject({
      status: 'SUPPORTED',
      structureStatus: 'SUPPORTED',
      minimumVolumeStatus: 'MET',
    })
    for (const muscle of [
      'quadriceps',
      'gluteals',
      'hamstrings',
      'chest',
      'triceps',
      'latissimus',
      'upper back',
      'trunk',
    ]) {
      expect(
        (generated.strengthWeek?.completedVolume[muscle] ?? 0) +
          (generated.strengthWeek?.plannedVolume[muscle] ?? 0),
        muscle,
      ).toBeGreaterThanOrEqual(generated.strengthWeek!.minimumSetsPerMuscle)
    }
  })

  it('annostelee dead bugin core-hallintaliikkeenä ilman kilogrammakalibrointia', () => {
    const upperA = unrestrictedFourDayPlan().sessions.find(
      (session) => session.strengthWeekContext?.role === 'UPPER_A',
    )!
    const prescription = upperA.prescriptionDetail
    expect(prescription).toBeDefined()
    if (!prescription) throw new Error('UPPER_A prescription missing')
    const deadBug = prescription.exercises.find(
      (exercise) => exercise.code === 'DEAD_BUG',
    )
    expect(deadBug).toBeDefined()
    if (!deadBug) throw new Error('DEAD_BUG missing')
    expect(deadBug).toMatchObject({
      programmingRole: 'CORE_CONTROL',
      sets: 3,
      repetitions: '6–10 / puoli',
      restSeconds: 60,
      targetRpe: 7,
      loadType: 'BODYWEIGHT',
      loadLabelFi: 'Variaatio tai lisäpaino',
    })
    expect(deadBug.loadGuidance).toMatch(/hengitys|hallinta/u)
    expect(deadBug.loadGuidance).not.toMatch(/kg|kalibroi kuorma/u)
    expect(deadBug.progressionDecision?.reasonCodes).toContain(
      'CORE_CONTROL_QUALITY_PROGRESSION',
    )
    expect(deadBug.stopCondition).toMatch(/asento|kipua/u)
    expect(calculateSessionPrimaryMuscleVolume([deadBug])).toEqual({ trunk: 3 })
  })

  it('selittää olkapään yläasentorajoitteen vuoksi suppean upper-rakenteen terveystekijällä', () => {
    const plan = generatePlan(
      input({
        experience: 'ADVANCED',
        availableDays: [1, 3, 5, 7],
        minutesPerSession: 90,
        minutesByDay: { '1': 90, '3': 90, '5': 90, '7': 90 },
        equipment: [
          'Kehonpaino',
          'Käsipainot',
          'Levytanko ja painot',
          'Vastuskuminauhat',
          'Kuntosalilaitteet',
        ],
        confirmedLimitationTags: ['OVERHEAD_RESTRICTION'],
      }),
    ).decision
    const uppers = plan.sessions.filter((session) =>
      session.strengthWeekContext?.role.startsWith('UPPER_'),
    )
    expect(uppers).toHaveLength(2)
    expect(
      uppers.every((session) =>
        session.prescriptionDetail?.exercises.every(
          (exercise) =>
            exercise.category !== 'VERTICAL_PUSH' &&
            exercise.category !== 'VERTICAL_PULL',
        ),
      ),
    ).toBe(true)
    expect(
      uppers.every((session) =>
        session.prescriptionDetail?.strengthRoleStructure?.reasonCodes.includes(
          STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_HEALTH_LIMITED,
        ),
      ),
    ).toBe(true)
    expect(plan.strengthWeek).toMatchObject({
      status: 'PARTIAL',
      structureStatus: 'CONSTRAINED',
    })
    expect(plan.strengthWeek?.supportDecision.messageFi).toMatch(/liikerajoit/u)
  })

  it.each([
    ['vain käsipainot', ['Kehonpaino', 'Käsipainot']],
    ['vain vastuskuminauhat', ['Kehonpaino', 'Vastuskuminauhat']],
  ] as const)(
    'selittää pitkän upper-rakenteen puutteen välinerajoitteella: %s',
    (_label, equipment) => {
      const plan = generatePlan(
        input({
          experience: 'ADVANCED',
          availableDays: [1, 3, 5, 7],
          minutesPerSession: 90,
          minutesByDay: { '1': 90, '3': 90, '5': 90, '7': 90 },
          equipment: [...equipment],
        }),
      ).decision
      const uppers = plan.sessions.filter((session) =>
        session.strengthWeekContext?.role.startsWith('UPPER_'),
      )
      expect(
        uppers.some((session) =>
          session.prescriptionDetail?.strengthRoleStructure?.reasonCodes.includes(
            STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_EQUIPMENT_LIMITED,
          ),
        ),
      ).toBe(true)
      expect(plan.strengthWeek).toMatchObject({
        status: 'PARTIAL',
        structureStatus: 'CONSTRAINED',
      })
      expect(plan.strengthWeek?.supportDecision.messageFi).toMatch(/väline/u)
    },
  )

  it('ei merkitse viikkoa tuetuksi, jos roolikohtainen vähimmäisrakenne on selittämättä vajaa', () => {
    const blueprint = createStrengthWeekBlueprint({
      weekAnchorDate: '2026-08-24',
      goal: 'MUSCLE_GAIN',
      experience: 'ADVANCED',
      availableAppDays: 4,
      fixedStrengthExposureCount: 0,
      fixedStrengthVolumeKnown: true,
      returning: false,
      equipment: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet'],
      history: [],
      trainingContinuityConfirmed: true,
      generatedAt,
    })
    const state = initialStrengthWeekMaterializationState(blueprint)
    state.materializedSessionCount = 4
    state.movementPatternCoverage = [
      'SQUAT',
      'HINGE',
      'HORIZONTAL_PUSH',
      'HORIZONTAL_PULL',
      'CORE',
    ]
    state.plannedVolume = Object.fromEntries(
      [
        'quadriceps',
        'gluteals',
        'hamstrings',
        'chest',
        'triceps',
        'latissimus',
        'upper back',
        'trunk',
      ].map((muscle) => [muscle, 8]),
    )
    state.roleStructures = [
      {
        role: 'UPPER_A',
        status: 'INVALID',
        minimumExerciseCount: 5,
        targetExerciseCount: 5,
        actualExerciseCount: 3,
        requiredSlotIds: ['push', 'pull', 'vertical-push', 'vertical-pull'],
        filledRequiredSlotIds: ['push', 'pull'],
        reasonCodes: [STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_INVALID],
        messageFi: 'Rakenne jäi vajaaksi.',
      },
    ]
    const plan = finalizeStrengthWeekPlan(blueprint, state)
    expect(plan.status).toBe('PARTIAL')
    expect(plan.structureStatus).toBe('INVALID')
    expect(plan.supportDecision.reasonCode).toBe(
      STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_INVALID,
    )
  })

  it('rajaa aloittelijan ja RETURNING-käyttäjän enintään kolmeen sekä kokeneen neljään', () => {
    expect(
      strengthSessions(input({ experience: 'BEGINNER', availableDays: [1, 2, 3, 4, 5] })),
    ).toHaveLength(3)
    const returningSessions = strengthSessions(
      input({
        availableDays: [1, 2, 3, 4, 5],
        generatedAt: '2026-10-30T08:00:00.000Z',
        weekAnchorDate: '2026-10-26',
        strengthTrainingBackground: {
          regularTrainingAtLeast12Weeks: true,
          lastStrengthWorkoutAt: '2026-08-26T08:00:00.000Z',
          source: 'USER_CONFIRMED',
          confirmedAt: '2026-10-30T07:00:00.000Z',
          policyVersion: 'adult-strength-return-1.0.0',
        },
      }),
    )
    expect(returningSessions.length).toBeGreaterThanOrEqual(2)
    expect(returningSessions.length).toBeLessThanOrEqual(3)
    expect(
      strengthSessions(input({ experience: 'ADVANCED', availableDays: [1, 2, 3, 4, 5] })),
    ).toHaveLength(4)
  })

  it('kierrättää 10 minuutin A:n polvi+veto- ja B:n lonkka+työntöparina', () => {
    const sessions = strengthSessions(
      input({
        availableDays: [1, 4],
        minutesPerSession: 10,
        minutesByDay: { '1': 10, '4': 10 },
      }),
    )
    expect(
      sessions[0]?.prescriptionDetail?.exercises.map((item) => item.category),
    ).toEqual(['SQUAT', 'HORIZONTAL_PULL'])
    expect(
      sessions[1]?.prescriptionDetail?.exercises.map((item) => item.category),
    ).toEqual(['HINGE', 'HORIZONTAL_PUSH'])
    expect(sessions.every((session) => session.durationMinutes <= 10)).toBe(true)
  })

  it('materialisoi neljä 20 minuutin päivää järjestyksessä aikabudjetit säilyttäen', () => {
    const sessions = strengthSessions(
      input({
        minutesPerSession: 20,
        minutesByDay: { '1': 20, '2': 20, '4': 20, '6': 20 },
      }),
    )
    expect(sessions).toHaveLength(4)
    expect(sessions.every((session) => session.durationMinutes <= 20)).toBe(true)
    expect(sessions.at(-1)?.strengthWeekContext?.plannedVolumeBefore).not.toEqual({})
  })

  it('pyrkii 30 minuutissa 4–5 tarkoituksenmukaiseen liikkeeseen tuetulla profiililla', () => {
    const sessions = strengthSessions(
      input({
        availableDays: [1, 4],
        minutesPerSession: 30,
        minutesByDay: { '1': 30, '4': 30 },
        equipment: ['Kehonpaino', 'Käsipainot', 'Vastuskuminauhat', 'Kuntosalilaitteet'],
      }),
    )
    expect(sessions).toHaveLength(2)
    expect(
      sessions.every((session) => {
        const count = session.prescriptionDetail?.exercises.length ?? 0
        return count >= 3 && count <= 5
      }),
    ).toBe(true)
  })

  it.each([45, 60, 90])(
    'muodostaa kolmen päivän täyden kuntosaliviikon %i minuutissa core-peitolla',
    (minutes) => {
      const plan = generatePlan(
        input({
          availableDays: [1, 3, 5],
          minutesPerSession: minutes,
          minutesByDay: { '1': minutes, '3': minutes, '5': minutes },
          equipment: [
            'Kehonpaino',
            'Käsipainot',
            'Levytanko ja painot',
            'Kuntosalilaitteet',
            'Vastuskuminauhat',
          ],
        }),
      ).decision
      expect(plan.strengthWeek?.status).toBe('SUPPORTED')
      expect(plan.strengthWeek?.movementPatternCoverage).toContain('CORE')
      expect(plan.strengthWeek?.missingMovementPatterns).toEqual([])
      expect(
        plan.sessions.filter(
          (session) => session.kind === 'STRENGTH' && session.unsupportedPrescription,
        ),
      ).toEqual([])
    },
  )

  it('muodostaa jatkuvuuden vahvistaneelle käyttäjälle tuetun 45 minuutin saliviikon ilman sovellushistoriaa', () => {
    const plan = generatePlan(
      input({
        availableDays: [1, 3, 5],
        minutesPerSession: 45,
        minutesByDay: { '1': 45, '3': 45, '5': 45 },
        strengthHistory: [],
        likes: 'Maljakyykky',
        equipment: [
          'Kehonpaino',
          'Käsipainot',
          'Levytanko ja painot',
          'Kuntosalilaitteet',
          'Vastuskuminauhat',
        ],
      }),
    ).decision
    expect(plan.strengthWeek).toMatchObject({
      status: 'SUPPORTED',
      structureStatus: 'SUPPORTED',
      minimumVolumeStatus: 'MET',
    })
    expect(plan.strengthWeek?.movementPatternCoverage).toContain('CORE')
    expect(plan.strengthWeek?.plannedVolume.hamstrings).toBeGreaterThanOrEqual(8)
  })

  it.each(['INTERMEDIATE', 'ADVANCED'] as const)(
    'säilyttää 30 minuutin %s-viikossa työntävän liikkeen ja coren sekä ilmoittaa vajaasta volyymista',
    (experience) => {
      const plan = generatePlan(
        input({
          experience,
          availableDays: [1, 3, 5],
          minutesPerSession: 30,
          minutesByDay: { '1': 30, '3': 30, '5': 30 },
        }),
      ).decision
      expect(plan.strengthWeek?.status).toBe('PARTIAL')
      expect(plan.strengthWeek?.movementPatternCoverage).toEqual(
        expect.arrayContaining(['HORIZONTAL_PUSH', 'CORE']),
      )
    },
  )

  it('antaa neljän päivän upper/lower-viikossa kaksi polvidominanttia altistusta ja muutakin kuin RDL:n', () => {
    const plan = generatePlan(
      input({
        experience: 'ADVANCED',
        availableDays: [1, 2, 4, 6],
        equipment: [
          'Kehonpaino',
          'Käsipainot',
          'Levytanko ja painot',
          'Kuntosalilaitteet',
          'Vastuskuminauhat',
        ],
      }),
    ).decision
    const lower = plan.sessions.filter((session) =>
      session.strengthWeekContext?.role.startsWith('LOWER_'),
    )
    expect(lower).toHaveLength(2)
    expect(
      lower.every((session) =>
        session.prescriptionDetail?.exercises.some(
          (exercise) =>
            exercise.category === 'SQUAT' || exercise.category === 'SINGLE_LEG',
        ),
      ),
    ).toBe(true)
    expect(
      lower.find((session) => session.strengthWeekContext?.role === 'LOWER_B')
        ?.prescriptionDetail?.exercises.length,
    ).toBeGreaterThan(1)
  })

  it('säilyttää coren neljässä 20 minuutin harjoituksessa ja ilmoittaa vajaasta volyymista', () => {
    const plan = generatePlan(
      input({
        experience: 'ADVANCED',
        availableDays: [1, 2, 4, 6],
        minutesPerSession: 20,
        minutesByDay: { '1': 20, '2': 20, '4': 20, '6': 20 },
      }),
    ).decision
    expect(plan.strengthWeek?.movementPatternCoverage).toContain('CORE')
    expect(plan.strengthWeek?.status).toBe('PARTIAL')
  })

  it('laskee suunnitellut sarjat kerran ja portittaa myöhemmät päivät 16/6-katoilla', () => {
    const plan = generatePlan(input()).decision
    const sessions = plan.sessions.filter(
      (session) => session.source === 'APP' && session.kind === 'STRENGTH',
    )
    const allPlanned = calculatePlannedMuscleVolume(
      sessions.flatMap((session) => session.prescriptionDetail?.exercises ?? []),
    )
    expect(plan.strengthWeek?.plannedVolume).toEqual(allPlanned)
    for (const amount of Object.values(plan.strengthWeek?.plannedVolume ?? {})) {
      expect(amount).toBeLessThanOrEqual(MAX_ROLLING_MUSCLE_SETS)
    }
    expect(plan.strengthWeek?.reasonCodes).toContain(
      STRENGTH_WEEK_REASON_CODES.MUSCLE_EXPOSURE_CAPPED,
    )
    for (const session of sessions) {
      const primaryVolume: Record<string, number> = {}
      for (const exercise of session.prescriptionDetail?.exercises ?? []) {
        for (const muscle of exercise.primaryMuscles ?? []) {
          primaryVolume[muscle] = (primaryVolume[muscle] ?? 0) + exercise.sets
        }
      }
      for (const amount of Object.values(primaryVolume)) {
        expect(amount).toBeLessThanOrEqual(MAX_SESSION_PRIMARY_MUSCLE_SETS)
      }
    }
  })

  it('ei laske samaa toteutunutta ja suunniteltua harjoitusta kahdesti', () => {
    const plan = generatePlan(input()).decision
    expect(plan.strengthWeek?.completedVolume.quadriceps).toBe(1)
    expect(plan.strengthWeek?.plannedVolume.quadriceps).toBeGreaterThan(0)
    expect(plan.strengthWeek?.hardCapRemaining.quadriceps).toBe(
      MAX_ROLLING_MUSCLE_SETS -
        plan.strengthWeek!.completedVolume.quadriceps! -
        plan.strengthWeek!.plannedVolume.quadriceps!,
    )
  })

  it('korvaa saman blueprintin toteutuneen maanantain täsmälleen eikä muuta keskiviikkoa tai tuplaa volyymia', () => {
    const baselineInput = input({ availableDays: [1, 3, 5] })
    const baseline = generatePlan(baselineInput).decision
    const monday = baseline.sessions.find(
      (session) => session.strengthWeekContext?.role === 'FULL_BODY_A',
    )!
    const wednesday = baseline.sessions.find(
      (session) => session.strengthWeekContext?.role === 'FULL_BODY_B',
    )!
    const completedMonday = monday.prescriptionDetail!.exercises.flatMap((exercise) =>
      Array.from({ length: exercise.sets }, () =>
        successfulHistory({
          sessionId: monday.id,
          exerciseCode: exercise.code,
          exerciseVersion: exercise.contentVersion,
          movementPatterns: [exercise.category],
          primaryMuscles: exercise.primaryMuscles,
          secondaryMuscles: exercise.secondaryMuscles,
          loadType: exercise.loadType,
          loadContextId: exercise.loadContextId,
          loadKg: exercise.loadType === 'BODYWEIGHT' ? null : 20,
          repetitions: Number(exercise.repetitions?.match(/\d+/u)?.[0] ?? 8),
          completedAt: '2026-08-27T07:30:00.000Z',
        }),
      ),
    )
    const refreshed = generatePlan(
      input({
        availableDays: [1, 3, 5],
        strengthHistory: [successfulHistory(), ...completedMonday],
        completedStrengthSessionIds: [monday.id],
      }),
    ).decision
    const refreshedWednesday = refreshed.sessions.find(
      (session) => session.strengthWeekContext?.role === 'FULL_BODY_B',
    )!
    expect(refreshed.sessions.some((session) => session.id === monday.id)).toBe(false)
    expect(
      refreshedWednesday.prescriptionDetail?.exercises.map(({ code, sets }) => ({
        code,
        sets,
      })),
    ).toEqual(
      wednesday.prescriptionDetail?.exercises.map(({ code, sets }) => ({ code, sets })),
    )
    for (const muscle of new Set([
      ...Object.keys(baseline.strengthWeek?.completedVolume ?? {}),
      ...Object.keys(baseline.strengthWeek?.plannedVolume ?? {}),
    ])) {
      const before =
        (baseline.strengthWeek?.completedVolume[muscle] ?? 0) +
        (baseline.strengthWeek?.plannedVolume[muscle] ?? 0)
      const after =
        (refreshed.strengthWeek?.completedVolume[muscle] ?? 0) +
        (refreshed.strengthWeek?.plannedVolume[muscle] ?? 0)
      expect(after).toBe(before)
      expect(after).toBeLessThanOrEqual(MAX_ROLLING_MUSCLE_SETS)
    }
  })

  it('palauttaa BODYWEIGHT_ONLY-profiilille eksplisiittisen välinerajan', () => {
    const result = generatePlan(
      input({
        availableDays: [1, 4],
        equipment: ['Kehonpaino'],
        strengthHistory: [],
      }),
    )
    expect(result.decision.strengthWeek?.status).toBe('UNSUPPORTED')
    expect(
      result.decision.sessions.some(
        (session) => session.kind === 'STRENGTH' && Boolean(session.prescriptionDetail),
      ),
    ).toBe(false)
    expect(result.decision.strengthWeek?.reasonCodes).toContain(
      STRENGTH_WEEK_REASON_CODES.PULL_EQUIPMENT_REQUIRED,
    )
    expect(
      result.reasons.find((reason) => reason.code === 'PULL_PATTERN_EQUIPMENT_REQUIRED')
        ?.message,
    ).toBe(
      'Täysi kotivoimaohjelma tarvitsee vetoliikettä varten vähintään pitkän vastuskuminauhan tai muun Haukkarin tukeman välineen.',
    )
  })

  it.each([
    { equipment: ['Vastuskuminauhat'] },
    { equipment: ['Kehonpaino', 'Käsipainot'] },
    { equipment: ['Kehonpaino', 'Kuntosalilaitteet'] },
    {
      equipment: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet', 'Levytanko ja painot'],
    },
  ])(
    'auditoi tuetun välineprofiilin ilman hiljaista vetopuutetta: $equipment',
    ({ equipment }) => {
      const plan = generatePlan(input({ equipment })).decision
      expect(plan.strengthWeek?.reasonCodes).not.toContain(
        STRENGTH_WEEK_REASON_CODES.PULL_EQUIPMENT_REQUIRED,
      )
      expect(
        plan.strengthWeek?.movementPatternCoverage.includes('HORIZONTAL_PULL') ||
          plan.strengthWeek?.missingMovementPatterns.includes('HORIZONTAL_PULL'),
      ).toBe(true)
    },
  )

  it('laskee ulkopuolisen tuntemattoman voimaharjoituksen frekvenssiin mutta pidättää sarjaprogression', () => {
    const plan = generatePlan(
      input({
        fixedSessions: [
          {
            id: 'external-strength',
            day: 1,
            kind: 'STRENGTH',
            durationMinutes: 45,
            intensity: 'MODERATE',
            loadRegion: 'FULL_BODY',
            fixed: true,
            source: 'COACH',
          },
        ],
      }),
    ).decision
    expect(plan.strengthWeek?.fixedStrengthExposureCount).toBe(1)
    expect(plan.strengthWeek?.reasonCodes).toContain('EXTERNAL_STRENGTH_VOLUME_UNKNOWN')
    expect(
      plan.sessions
        .flatMap((session) => session.prescriptionDetail?.exercises ?? [])
        .some((exercise) => exercise.progressionDecision?.action === 'INCREASE_SETS'),
    ).toBe(false)
  })

  it('laskee tunnetun ulkopuolisen prescriptionin volyymin kerran ennen sovelluksen seuraavaa harjoitusta', () => {
    const sourceSession = strengthSessions(input({ availableDays: [1, 4] }))[0]!
    const fixedSession = {
      ...sourceSession,
      id: 'known-external-strength',
      day: 1,
      fixed: true,
      source: 'COACH' as const,
      strengthWeekContext: undefined,
    }
    const fixedVolume = calculatePlannedMuscleVolume(
      fixedSession.prescriptionDetail!.exercises,
    )
    const plan = generatePlan(
      input({ availableDays: [1, 4], fixedSessions: [fixedSession] }),
    ).decision
    expect(plan.strengthWeek?.fixedStrengthExposureCount).toBe(1)
    expect(plan.strengthWeek?.reasonCodes).not.toContain(
      STRENGTH_WEEK_REASON_CODES.EXTERNAL_VOLUME_UNKNOWN,
    )
    for (const [muscle, amount] of Object.entries(fixedVolume)) {
      expect(plan.strengthWeek?.plannedVolume[muscle]).toBeGreaterThanOrEqual(amount)
    }
  })

  it('tuottaa samalla täydellä syötteellä tavutasolla saman viikon', () => {
    const first = generatePlan(input()).decision
    const second = generatePlan(input()).decision
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.strengthWeek?.policyVersion).toBe(STRENGTH_WEEK_POLICY_VERSION)
  })

  it('jatkaa väliin jääneen A-harjoituksen jälkeen B:stä eikä maksa sarjoja takaisin', () => {
    const baseline = generatePlan(input({ availableDays: [1, 3, 5] })).decision
    const missedId = baseline.sessions.find(
      (session) =>
        session.kind === 'STRENGTH' &&
        session.strengthWeekContext?.role === 'FULL_BODY_A',
    )!.id
    const next = generatePlan(
      input({ availableDays: [1, 3, 5], missedSessionId: missedId }),
    ).decision
    const sessions = next.sessions.filter(
      (session) => session.kind === 'STRENGTH' && session.source === 'APP',
    )
    expect(sessions[0]?.strengthWeekContext?.role).toBe('FULL_BODY_B')
    expect(next.strengthWeek?.reasonCodes).toContain('MISSED_SESSION_NOT_DOUBLED')
    expect(next.strengthWeek!.plannedVolume).not.toEqual(
      baseline.strengthWeek!.plannedVolume,
    )
  })

  it('näyttää yhden päivän rehellisenä osittaisena koko kehon altistuksena', () => {
    const plan = generatePlan(input({ availableDays: [3] })).decision
    expect(plan.sessions.filter((session) => session.kind === 'STRENGTH')).toHaveLength(1)
    expect(plan.strengthWeek?.status).toBe('PARTIAL')
    expect(plan.strengthWeek?.reasonCodes).toContain('ONE_DAY_FULL_BODY_PARTIAL_COVERAGE')
  })

  it('sallii sarjan vasta kahden laadukkaan eri viikkoikkunan jälkeen ja muuttaa vain sarjoja', () => {
    const history = [
      successfulHistory({
        sessionId: 'week-current',
        exerciseCode: 'REVERSE_LUNGE',
        loadType: 'BODYWEIGHT',
        loadKg: null,
        repetitions: 12,
        completedAt: '2026-08-26T08:00:00.000Z',
      }),
      successfulHistory({
        sessionId: 'week-prior',
        exerciseCode: 'REVERSE_LUNGE',
        loadType: 'BODYWEIGHT',
        loadKg: null,
        repetitions: 12,
        completedAt: '2026-08-18T08:00:00.000Z',
      }),
      ...continuityHistory(),
    ]
    const plan = generatePlan(
      input({
        equipment: ['Kehonpaino', 'Vastuskuminauhat'],
        strengthHistory: history,
      }),
    ).decision
    const progression = plan.sessions
      .flatMap((session) => session.prescriptionDetail?.exercises ?? [])
      .find(
        (exercise) => exercise.progressionDecision?.action === 'INCREASE_SETS',
      )?.progressionDecision
    expect(progression).toMatchObject({
      action: 'INCREASE_SETS',
      changedVariable: 'SETS',
    })
    expect(progression?.nextLoadKg).toBeUndefined()
    expect(progression?.nextRepetitions).toBeUndefined()
  })

  it.each([
    { label: 'kipu', patch: { pain: true } },
    { label: 'STOP', patch: { stopped: true, completionStatus: 'STOPPED' as const } },
    { label: 'väärä RIR', patch: { rir: 5 } },
    { label: 'tekniikkavirhe', patch: { techniqueOk: false } },
    { label: 'vajaa annos', patch: { doseCompleted: false } },
    { label: 'huono palautuminen', patch: { severeRecoveryProblem: true } },
  ])('$label estää sarjaprogression', ({ patch }) => {
    const history = [
      successfulHistory({
        sessionId: 'week-current',
        exerciseCode: 'REVERSE_LUNGE',
        loadType: 'BODYWEIGHT',
        loadKg: null,
        repetitions: 12,
        completedAt: '2026-08-26T08:00:00.000Z',
        ...patch,
      }),
      successfulHistory({
        sessionId: 'week-prior',
        exerciseCode: 'REVERSE_LUNGE',
        loadType: 'BODYWEIGHT',
        loadKg: null,
        repetitions: 12,
        completedAt: '2026-08-18T08:00:00.000Z',
      }),
      ...continuityHistory(),
    ]
    const plan = generatePlan(
      input({
        equipment: ['Kehonpaino', 'Vastuskuminauhat'],
        strengthHistory: history,
      }),
    ).decision
    expect(
      plan.sessions
        .flatMap((session) => session.prescriptionDetail?.exercises ?? [])
        .some((exercise) => exercise.progressionDecision?.action === 'INCREASE_SETS'),
    ).toBe(false)
  })

  it('RETURNING estää sarjaprogression ja sarjalisäys ei lyhennä lepoa tai puskuria', () => {
    const history = [
      successfulHistory({
        sessionId: 'return-current',
        exerciseCode: 'REVERSE_LUNGE',
        loadType: 'BODYWEIGHT',
        loadKg: null,
        repetitions: 12,
        completedAt: '2026-08-26T08:00:00.000Z',
      }),
      successfulHistory({
        sessionId: 'return-prior',
        exerciseCode: 'REVERSE_LUNGE',
        loadType: 'BODYWEIGHT',
        loadKg: null,
        repetitions: 12,
        completedAt: '2026-08-18T08:00:00.000Z',
      }),
      ...continuityHistory(),
    ]
    const active = generatePlan(
      input({
        equipment: ['Kehonpaino', 'Vastuskuminauhat'],
        strengthHistory: history,
      }),
    ).decision
    const progressed = active.sessions
      .flatMap((session) => session.prescriptionDetail?.exercises ?? [])
      .find((exercise) => exercise.progressionDecision?.action === 'INCREASE_SETS')
    const activeSession = active.sessions.find((session) =>
      session.prescriptionDetail?.exercises.includes(progressed!),
    )!
    expect(progressed?.restSeconds).toBeGreaterThanOrEqual(60)
    expect(
      activeSession.prescriptionDetail?.timeBreakdown?.bufferSeconds,
    ).toBeGreaterThanOrEqual(30)
    expect(activeSession.durationMinutes).toBeLessThanOrEqual(
      activeSession.timeBudgetMinutes!,
    )

    const returning = generatePlan(
      input({
        equipment: ['Kehonpaino', 'Vastuskuminauhat'],
        strengthHistory: history,
        generatedAt: '2026-11-27T08:00:00.000Z',
        weekAnchorDate: '2026-11-23',
        strengthTrainingBackground: {
          regularTrainingAtLeast12Weeks: true,
          lastStrengthWorkoutAt: '2026-08-26T08:00:00.000Z',
          source: 'USER_CONFIRMED',
          confirmedAt: '2026-11-27T07:00:00.000Z',
          policyVersion: 'adult-strength-return-1.0.0',
        },
      }),
    ).decision
    expect(
      returning.sessions
        .flatMap((session) => session.prescriptionDetail?.exercises ?? [])
        .some((exercise) => exercise.progressionDecision?.action === 'INCREASE_SETS'),
    ).toBe(false)
  })
})
