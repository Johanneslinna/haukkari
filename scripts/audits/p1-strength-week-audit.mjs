import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const server = await createServer({
  root: repoRoot,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const TOTAL_CASES = 50_000
const generatedAt = '2026-08-27T08:00:00.000Z'
const goals = ['GENERAL_FITNESS', 'MAX_STRENGTH', 'MUSCLE_GAIN']
const experiences = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
const returnStates = ['ACTIVE', 'RETURNING']
const dayCounts = [1, 2, 3, 4, 5]
const budgets = [10, 20, 30, 45, 60, 90]
const equipmentProfiles = [
  { className: 'BODYWEIGHT_ONLY', values: ['Kehonpaino'] },
  { className: 'BANDS', values: ['Kehonpaino', 'Vastuskuminauhat'] },
  { className: 'DUMBBELLS', values: ['Kehonpaino', 'Käsipainot'] },
  { className: 'MACHINES', values: ['Kehonpaino', 'Kuntosalilaitteet'] },
  {
    className: 'FULL_GYM',
    values: [
      'Kehonpaino',
      'Vastuskuminauhat',
      'Käsipainot',
      'Kuntosalilaitteet',
      'Levytanko ja painot',
    ],
  },
]
const historyProfiles = ['EMPTY', 'COLD_START', 'STABLE', 'HIGH_VOLUME']
const recoveryProfiles = ['ALLOWED', 'WITHHELD']
const ages = [17, 18, 64, 65]
const readinessStates = ['GREEN', 'YELLOW', 'ORANGE_RECOVERY', 'RED_STOP']
const booleanValues = [false, true]
const requiredPatterns = ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL', 'CORE']

function stableSet(overrides = {}) {
  return {
    sessionId: 'stable-session',
    exerciseCode: 'CHAIR_SQUAT',
    exerciseVersion: '1.0.0',
    movementPatterns: ['SQUAT'],
    primaryMuscles: ['quadriceps', 'gluteals'],
    secondaryMuscles: ['trunk'],
    loadKg: null,
    loadType: 'BODYWEIGHT',
    repetitions: 10,
    rir: 3,
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
    stableSet({
      sessionId: `continuity-${index}`,
      exerciseCode: `LEGACY_CONTINUITY_${index}`,
      exerciseVersion: 'snapshot-1',
      primaryMuscles: ['trunk'],
      secondaryMuscles: [],
      completedAt: `${date}T08:00:00.000Z`,
    }),
  )
}

function historyFor(profile, recovery) {
  if (profile === 'EMPTY') return []
  if (profile === 'HIGH_VOLUME') {
    return Array.from({ length: 16 }, (_, index) =>
      stableSet({
        sessionId: `high-${index}`,
        exerciseCode: `SNAPSHOT_${index}`,
        exerciseVersion: 'snapshot-1',
        primaryMuscles: [
          'quadriceps',
          'gluteals',
          'hamstrings',
          'chest',
          'triceps',
          'latissimus',
          'upper back',
          'trunk',
        ],
        secondaryMuscles: [],
        completedAt: `2026-08-${String(26 - (index % 6)).padStart(2, '0')}T08:00:00.000Z`,
      }),
    )
  }
  if (profile === 'COLD_START') {
    return [stableSet({ completedAt: '2026-06-01T08:00:00.000Z' })]
  }
  return [
    stableSet({ sessionId: 'stable-current', pain: recovery === 'WITHHELD' }),
    stableSet({
      sessionId: 'stable-prior',
      completedAt: '2026-08-18T08:00:00.000Z',
      severeRecoveryProblem: recovery === 'WITHHELD',
    }),
    ...continuityHistory(),
  ]
}

function dimension(index, divisor, values) {
  return values[Math.floor(index / divisor) % values.length]
}

function incrementCount(map, value) {
  map[value] = (map[value] ?? 0) + 1
}

function incrementCross(map, left, right) {
  map[left] ??= {}
  incrementCount(map[left], right)
}

function sortedObject(value) {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [
        key,
        nested && typeof nested === 'object' && !Array.isArray(nested)
          ? sortedObject(nested)
          : nested,
      ]),
  )
}

function expectedSafetyReason({ age, readiness, healthBlocked, safetyComplete }) {
  if (healthBlocked) return 'HEALTH_ENGINE_NOT_AVAILABLE'
  if (readiness === 'RED_STOP') return 'READINESS_RED_STOP'
  if (!safetyComplete) return 'SAFETY_INFORMATION_INCOMPLETE'
  if (age < 18) return 'YOUTH_ENGINE_NOT_AVAILABLE'
  if (age >= 65) return 'OLDER_ADULT_ENGINE_NOT_AVAILABLE'
  if (readiness === 'ORANGE_RECOVERY') return 'READINESS_RECOVERY_ONLY'
  return null
}

function planInput({
  goal,
  experience,
  returnState,
  dayCount,
  budget,
  equipment,
  historyProfile,
  recovery,
  history,
}) {
  const returning = returnState === 'RETURNING'
  const availableDays = [1, 2, 3, 4, 5].slice(0, dayCount)
  return {
    goal: { primary: goal, secondary: [], inputs: {} },
    experience,
    availableDays,
    currentEnduranceMinutes: 0,
    fixedSessions: [],
    competitions: [],
    equipment: equipment.values,
    physicalLoad: 'MODERATE',
    minutesPerSession: budget,
    minutesByDay: Object.fromEntries(availableDays.map((day) => [String(day), budget])),
    age: 35,
    generatedAt: returning ? '2026-11-27T08:00:00.000Z' : generatedAt,
    calendarTimeZone: 'Europe/Helsinki',
    localDate: returning ? '2026-11-27' : '2026-08-27',
    weekAnchorDate: returning ? '2026-11-23' : '2026-08-24',
    strengthHistory: history ?? historyFor(historyProfile, recovery),
    strengthTrainingBackground: {
      regularTrainingAtLeast12Weeks: true,
      lastStrengthWorkoutAt: '2026-08-26T08:00:00.000Z',
      source: 'USER_CONFIRMED',
      confirmedAt: returning ? '2026-11-27T07:00:00.000Z' : '2026-08-27T07:00:00.000Z',
      policyVersion: 'adult-strength-return-1.0.0',
    },
  }
}

function strengthSessions(decision) {
  return decision.sessions.filter(
    (session) => session.source === 'APP' && session.kind === 'STRENGTH',
  )
}

function checkAcceptanceCases(generatePlan) {
  const supportedEquipment = equipmentProfiles.at(-1)
  const scenario = (overrides = {}) =>
    generatePlan(
      planInput({
        goal: 'MUSCLE_GAIN',
        experience: 'INTERMEDIATE',
        returnState: 'ACTIVE',
        dayCount: 3,
        budget: 45,
        equipment: supportedEquipment,
        historyProfile: 'STABLE',
        recovery: 'ALLOWED',
        ...overrides,
      }),
    ).decision
  const body = (budget) =>
    scenario({
      dayCount: 2,
      budget,
      equipment: equipmentProfiles[0],
      historyProfile: 'EMPTY',
    })
  const explicitRestriction = (decision) =>
    decision.strengthWeek?.status === 'UNSUPPORTED' &&
    decision.strengthWeek.supportDecision.reasonCode ===
      'PULL_PATTERN_EQUIPMENT_REQUIRED' &&
    strengthSessions(decision).every(
      (session) =>
        !session.prescriptionDetail &&
        session.unsupportedPrescription?.reasonCode === 'PULL_PATTERN_EQUIPMENT_REQUIRED',
    )
  const threeDay = scenario()
  const fourDay = scenario({ experience: 'ADVANCED', dayCount: 4, budget: 45 })
  const fourByTwenty = scenario({
    experience: 'ADVANCED',
    dayCount: 4,
    budget: 20,
  })
  const beginnerFive = scenario({ experience: 'BEGINNER', dayCount: 5 })
  const advancedFive = scenario({ experience: 'ADVANCED', dayCount: 5 })
  const progressionHistory = [
    stableSet({
      sessionId: 'week-current',
      exerciseCode: 'REVERSE_LUNGE',
      exerciseVersion: '1.0.0',
      movementPatterns: ['SINGLE_LEG'],
      loadType: 'BODYWEIGHT',
      loadKg: null,
      repetitions: 12,
      completedAt: '2026-08-26T08:00:00.000Z',
    }),
    stableSet({
      sessionId: 'week-prior',
      exerciseCode: 'REVERSE_LUNGE',
      exerciseVersion: '1.0.0',
      movementPatterns: ['SINGLE_LEG'],
      loadType: 'BODYWEIGHT',
      loadKg: null,
      repetitions: 12,
      completedAt: '2026-08-18T08:00:00.000Z',
    }),
    ...continuityHistory(),
  ]
  const progression = scenario({
    dayCount: 4,
    equipment: equipmentProfiles[1],
    history: progressionHistory,
  })
  const roles = (decision) =>
    strengthSessions(decision).map((session) => session.strengthWeekContext?.role)
  const coverageComplete = (decision) =>
    requiredPatterns.every((pattern) =>
      decision.strengthWeek?.movementPatternCoverage.includes(pattern),
    )
  return {
    1: explicitRestriction(body(20))
      ? 'RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION'
      : 'FAIL',
    2:
      threeDay.strengthWeek?.status === 'SUPPORTED' &&
      strengthSessions(threeDay)
        .slice(1)
        .every(
          (session) =>
            Object.keys(session.strengthWeekContext?.plannedVolumeBefore ?? {}).length >
            0,
        )
        ? 'PASS'
        : 'FAIL',
    5:
      JSON.stringify(roles(threeDay)) ===
      JSON.stringify(['FULL_BODY_A', 'FULL_BODY_B', 'FULL_BODY_C'])
        ? 'PASS'
        : 'FAIL',
    6:
      JSON.stringify(roles(fourDay)) ===
      JSON.stringify(['UPPER_A', 'LOWER_A', 'UPPER_B', 'LOWER_B'])
        ? 'PASS'
        : 'FAIL',
    10: explicitRestriction(body(10))
      ? 'RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION'
      : 'FAIL',
    11:
      strengthSessions(fourByTwenty).length === 4 &&
      strengthSessions(fourByTwenty).every((session) => session.durationMinutes <= 20) &&
      coverageComplete(fourByTwenty)
        ? 'PASS'
        : 'FAIL',
    12: explicitRestriction(body(30))
      ? 'RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION'
      : 'FAIL',
    14:
      strengthSessions(beginnerFive).length === 3 &&
      strengthSessions(advancedFive).length === 4
        ? 'PASS'
        : 'FAIL',
    22: strengthSessions(progression)
      .flatMap((session) => session.prescriptionDetail?.exercises ?? [])
      .some(
        (exercise) =>
          exercise.progressionDecision?.action === 'INCREASE_SETS' &&
          exercise.progressionDecision.changedVariable === 'SETS',
      )
      ? 'PASS'
      : 'FAIL',
  }
}

try {
  const engine = await server.ssrLoadModule('/src/domain/coaching/index.ts')
  const ids = await server.ssrLoadModule('/src/domain/sync/DeterministicUuid.ts')
  const {
    MAX_ROLLING_MUSCLE_SETS,
    MAX_SESSION_PRIMARY_MUSCLE_SETS,
    adaptPrescription,
    calculatePlannedMuscleVolume,
    calculateSessionPrimaryMuscleVolume,
    createLocalCalendarContext,
    generatePlan,
  } = engine
  const { deterministicWeeklyPlanIds } = ids
  const counts = { SUPPORTED: 0, PARTIAL: 0, UNSUPPORTED: 0 }
  const statusByReason = {}
  const statusByEquipment = {}
  const statusByTime = {}
  const statusByDays = {}
  const normalBetaDistribution = { SUPPORTED: 0, PARTIAL: 0, UNSUPPORTED: 0 }
  const expectedBlockedCount = {}
  const supportedClassCoverage = {
    age: new Set(),
    goal: new Set(),
    experience: new Set(),
    readiness: new Set(),
    equipment: new Set(),
  }
  const violations = []
  let allowedPrescriptionCount = 0
  let adaptationEvaluatedCount = 0
  let unexpectedBlockedCount = 0
  let noSafeSessionCount = 0
  let noSafeCaseCount = 0

  for (let index = 0; index < TOTAL_CASES; index += 1) {
    const goal = dimension(index, 1, goals)
    const experience = dimension(index, 3, experiences)
    const returnState = dimension(index, 7, returnStates)
    const dayCount = dimension(index, 11, dayCounts)
    const budget = dimension(index, 17, budgets)
    const equipment = dimension(index, 23, equipmentProfiles)
    const historyProfile = dimension(index, 29, historyProfiles)
    const recovery = dimension(index, 31, recoveryProfiles)
    const age = dimension(index, 37, ages)
    const readiness = dimension(index, 41, readinessStates)
    const healthBlocked = dimension(index, 43, booleanValues)
    const safetyComplete = !dimension(index, 47, booleanValues)
    const input = planInput({
      goal,
      experience,
      returnState,
      dayCount,
      budget,
      equipment,
      historyProfile,
      recovery,
    })
    let result
    try {
      result = generatePlan(input)
    } catch (error) {
      violations.push(`case ${index}: engine threw ${String(error)}`)
      continue
    }
    const week = result.decision.strengthWeek
    const sessions = strengthSessions(result.decision)
    const prescribed = sessions.filter((session) => session.prescriptionDetail)
    const status = week?.status ?? 'UNSUPPORTED'
    const reasonCode = week?.supportDecision?.reasonCode ?? 'MISSING_WEEK_DECISION'
    incrementCount(counts, status)
    incrementCross(statusByReason, status, reasonCode)
    incrementCross(statusByEquipment, status, equipment.className)
    incrementCross(statusByTime, status, String(budget))
    incrementCross(statusByDays, status, String(dayCount))

    const noSafeInCase = sessions.filter(
      (session) =>
        session.unsupportedPrescription?.reasonCode === 'NO_SAFE_STRENGTH_DOSE_AVAILABLE',
    ).length
    noSafeSessionCount += noSafeInCase
    if (noSafeInCase > 0) noSafeCaseCount += 1

    if (status === 'SUPPORTED') {
      if (sessions.some((session) => session.unsupportedPrescription)) {
        violations.push(`case ${index}: SUPPORTED week contains unsupported child`)
      }
      if (prescribed.length !== sessions.length || prescribed.length === 0) {
        violations.push(`case ${index}: SUPPORTED week was not fully materialized`)
      }
      if ((week?.missingMovementPatterns.length ?? 1) > 0) {
        violations.push(`case ${index}: SUPPORTED week lacks required coverage`)
      }
    }
    if (status === 'PARTIAL') {
      if (prescribed.length === 0) {
        violations.push(`case ${index}: PARTIAL week has no usable session`)
      }
      if (reasonCode === 'STRENGTH_WEEK_FULLY_SUPPORTED') {
        violations.push(`case ${index}: PARTIAL week uses supported reason`)
      }
    }
    if (equipment.className === 'BODYWEIGHT_ONLY') {
      if (
        status !== 'UNSUPPORTED' ||
        reasonCode !== 'PULL_PATTERN_EQUIPMENT_REQUIRED' ||
        prescribed.length !== 0
      ) {
        violations.push(`case ${index}: BODYWEIGHT_ONLY contract was not fail-closed`)
      }
    }
    if (
      reasonCode === 'WEEKLY_VOLUME_BELOW_TARGET_TIME_LIMITED' &&
      (week?.supportDecision.evidence.remainingTimeSeconds ?? 0) >=
        (week?.supportDecision.evidence.minimumPolicyAdditionSeconds ?? 0)
    ) {
      violations.push(`case ${index}: TIME_LIMITED given although safe addition fits`)
    }

    for (const session of prescribed) {
      if (session.durationMinutes > budget) {
        violations.push(`case ${index}: time budget exceeded`)
      }
      if (
        !session.prescriptionDetail.exercises.length ||
        session.prescriptionDetail.exercises.some(
          (exercise) => !Number.isInteger(exercise.sets) || exercise.sets < 1,
        )
      ) {
        violations.push(`case ${index}: session has no meaningful dose`)
      }
      const primary = calculateSessionPrimaryMuscleVolume(
        session.prescriptionDetail.exercises,
      )
      for (const exercise of session.prescriptionDetail.exercises) {
        const progression = exercise.progressionDecision
        if (
          progression?.action === 'INCREASE_SETS' &&
          progression.changedVariable !== 'SETS'
        ) {
          violations.push(`case ${index}: set progression changed multiple variables`)
        }
      }
      if (
        Object.values(primary).some((amount) => amount > MAX_SESSION_PRIMARY_MUSCLE_SETS)
      ) {
        violations.push(`case ${index}: session muscle cap exceeded`)
      }

      const expectedReason = expectedSafetyReason({
        age,
        readiness,
        healthBlocked,
        safetyComplete,
      })
      const adapted = adaptPrescription(
        session.prescriptionDetail,
        {
          kind: 'FULL',
          timeBudgetMinutes:
            session.timeBudgetMinutes ?? session.prescriptionDetail.timeBudgetMinutes,
          durationMinutes: session.durationMinutes,
          volumeMultiplier: 1,
        },
        {
          age,
          readiness,
          healthBlocked,
          safetyInformationComplete: safetyComplete,
        },
      )
      adaptationEvaluatedCount += 1
      if (expectedReason) {
        incrementCount(expectedBlockedCount, expectedReason)
        const validRecovery =
          expectedReason === 'READINESS_RECOVERY_ONLY' &&
          adapted.status === 'SUPPORTED' &&
          adapted.prescription.kind !== 'STRENGTH'
        const validBlock =
          expectedReason !== 'READINESS_RECOVERY_ONLY' &&
          adapted.status === 'UNSUPPORTED' &&
          adapted.reasonCode === expectedReason
        if (!validRecovery && !validBlock) {
          unexpectedBlockedCount += 1
          violations.push(
            `case ${index}: adaptation expected ${expectedReason}, got ${adapted.status === 'SUPPORTED' ? adapted.prescription.kind : adapted.reasonCode}`,
          )
        }
      } else if (
        adapted.status !== 'SUPPORTED' ||
        adapted.prescription.kind !== 'STRENGTH'
      ) {
        unexpectedBlockedCount += 1
        violations.push(
          `case ${index}: supported adaptation unexpectedly blocked or changed kind`,
        )
      } else {
        allowedPrescriptionCount += 1
        supportedClassCoverage.age.add(String(age))
        supportedClassCoverage.goal.add(goal)
        supportedClassCoverage.experience.add(experience)
        supportedClassCoverage.readiness.add(readiness)
        supportedClassCoverage.equipment.add(equipment.className)
      }
    }

    const planned = calculatePlannedMuscleVolume(
      prescribed.flatMap((session) => session.prescriptionDetail.exercises),
    )
    if (JSON.stringify(planned) !== JSON.stringify(week?.plannedVolume ?? {})) {
      violations.push(`case ${index}: planned volume was not counted exactly once`)
    }
    const muscles = new Set([
      ...Object.keys(week?.completedVolume ?? {}),
      ...Object.keys(week?.plannedVolume ?? {}),
    ])
    for (const muscle of muscles) {
      if (
        (week.completedVolume[muscle] ?? 0) + (week.plannedVolume[muscle] ?? 0) >
        MAX_ROLLING_MUSCLE_SETS
      ) {
        violations.push(`case ${index}: rolling cap exceeded for ${muscle}`)
      }
    }

    const normalBetaCase =
      (age === 18 || age === 64) &&
      (readiness === 'GREEN' || readiness === 'YELLOW') &&
      !healthBlocked &&
      safetyComplete &&
      returnState === 'ACTIVE' &&
      dayCount >= 2 &&
      budget >= 30 &&
      equipment.className !== 'BODYWEIGHT_ONLY' &&
      historyProfile !== 'HIGH_VOLUME' &&
      recovery === 'ALLOWED'
    if (normalBetaCase) {
      incrementCount(normalBetaDistribution, status)
      if (status === 'UNSUPPORTED') {
        violations.push(`case ${index}: normal beta case was unsupported`)
      }
      if ((week?.missingMovementPatterns.length ?? 1) > 0) {
        violations.push(`case ${index}: normal beta case lacks movement coverage`)
      }
    }

    if (index % 1000 === 0) {
      const repeated = generatePlan(input)
      if (JSON.stringify(repeated.decision) !== JSON.stringify(result.decision)) {
        violations.push(`case ${index}: nondeterministic decision`)
      }
      if (sessions.length >= 2) {
        const missed = generatePlan({
          ...input,
          missedSessionId: sessions[0].id,
        }).decision
        const baselineTotal = Object.values(week?.plannedVolume ?? {}).reduce(
          (total, amount) => total + amount,
          0,
        )
        const missedTotal = Object.values(
          missed.strengthWeek?.plannedVolume ?? {},
        ).reduce((total, amount) => total + amount, 0)
        if (missedTotal > baselineTotal) {
          violations.push(`case ${index}: missed volume was accumulated`)
        }
        if (!missed.strengthWeek?.reasonCodes.includes('MISSED_SESSION_NOT_DOUBLED')) {
          violations.push(`case ${index}: missed-session decision was not traced`)
        }
      }
    }
  }

  const sunday = createLocalCalendarContext('2026-08-30T20:30:00.000Z', 'Europe/Helsinki')
  const monday = createLocalCalendarContext('2026-08-30T21:30:00.000Z', 'Europe/Helsinki')
  if (sunday.weekAnchorDate !== '2026-08-24' || monday.weekAnchorDate !== '2026-08-31') {
    violations.push('Europe/Helsinki week anchor rollover is incorrect')
  }
  const weeklyIdInput = {
    userId: '00000000-0000-4000-8000-000000000001',
    goalPeriodId: '00000000-0000-4000-8000-000000000002',
    calendarPolicyVersion: 'local-calendar-1.0.0',
    strengthWeekPolicyVersion: 'adult-strength-week-1.5.0',
  }
  const firstWeekIds = await deterministicWeeklyPlanIds({
    ...weeklyIdInput,
    weekAnchorDate: sunday.weekAnchorDate,
  })
  const repeatedFirstWeekIds = await deterministicWeeklyPlanIds({
    ...weeklyIdInput,
    weekAnchorDate: sunday.weekAnchorDate,
  })
  const nextWeekIds = await deterministicWeeklyPlanIds({
    ...weeklyIdInput,
    weekAnchorDate: monday.weekAnchorDate,
  })
  if (JSON.stringify(firstWeekIds) !== JSON.stringify(repeatedFirstWeekIds)) {
    violations.push('same weekly materialization did not reuse deterministic IDs')
  }
  if (
    firstWeekIds.planVersionId === nextWeekIds.planVersionId ||
    firstWeekIds.trainingPlanId === nextWeekIds.trainingPlanId
  ) {
    violations.push('weekly rollover reused a previous week ID')
  }

  const acceptanceCases = checkAcceptanceCases(generatePlan)
  for (const [caseNumber, outcome] of Object.entries(acceptanceCases)) {
    const expected = ['1', '10', '12'].includes(caseNumber)
      ? 'RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION'
      : 'PASS'
    if (outcome !== expected) {
      violations.push(
        `acceptance case ${caseNumber}: expected ${expected}, got ${outcome}`,
      )
    }
  }
  const evaluatedCases = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (evaluatedCases !== TOTAL_CASES) {
    violations.push(`evaluated ${evaluatedCases}/${TOTAL_CASES}`)
  }
  if (allowedPrescriptionCount < TOTAL_CASES * 0.02) {
    violations.push(
      `non-convincing allowed prescription count ${allowedPrescriptionCount}`,
    )
  }
  const requiredCoverage = {
    age: ['18', '64'],
    goal: goals,
    experience: experiences,
    readiness: ['GREEN', 'YELLOW'],
    equipment: equipmentProfiles
      .filter((profile) => profile.className !== 'BODYWEIGHT_ONLY')
      .map((profile) => profile.className),
  }
  for (const [dimensionName, requiredValues] of Object.entries(requiredCoverage)) {
    for (const value of requiredValues) {
      if (!supportedClassCoverage[dimensionName].has(value)) {
        violations.push(`no allowed prescription for ${dimensionName}=${value}`)
      }
    }
  }
  if (unexpectedBlockedCount !== 0) {
    violations.push(`unexpectedBlockedCount ${unexpectedBlockedCount}`)
  }

  const report = {
    policyVersion: 'adult-strength-week-1.5.0',
    calendarPolicyVersion: 'local-calendar-1.0.0',
    evaluatedCases,
    statusCounts: counts,
    statusByReason: sortedObject(statusByReason),
    statusByEquipment: sortedObject(statusByEquipment),
    statusByTime: sortedObject(statusByTime),
    statusByDays: sortedObject(statusByDays),
    normalBetaDistribution,
    adaptationEvaluatedCount,
    allowedPrescriptionCount,
    expectedBlockedCount: sortedObject(expectedBlockedCount),
    unexpectedBlockedCount,
    noSafeSessionCount,
    noSafeCaseCount,
    supportedClassCoverage: Object.fromEntries(
      Object.entries(supportedClassCoverage).map(([key, values]) => [
        key,
        [...values].sort(),
      ]),
    ),
    acceptanceCases,
    weeklyIdempotency: {
      sundayWeekAnchor: sunday.weekAnchorDate,
      mondayWeekAnchor: monday.weekAnchorDate,
      sameWeekIdsStable:
        JSON.stringify(firstWeekIds) === JSON.stringify(repeatedFirstWeekIds),
      nextWeekUsesNewIds:
        firstWeekIds.planVersionId !== nextWeekIds.planVersionId &&
        firstWeekIds.trainingPlanId !== nextWeekIds.trainingPlanId,
    },
    violations: violations.slice(0, 100),
    violationCount: violations.length,
  }
  console.log(JSON.stringify(report, null, 2))
  if (violations.length > 0) process.exitCode = 1
} finally {
  await server.close()
}
