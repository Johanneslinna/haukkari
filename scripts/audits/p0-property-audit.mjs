import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const server = await createServer({
  root: repoRoot,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const seedHex = '0x7a4f2c19'
let rngState = 0x7a4f2c19
function random() {
  rngState ^= rngState << 13
  rngState ^= rngState >>> 17
  rngState ^= rngState << 5
  return (rngState >>> 0) / 0x1_0000_0000
}
function pick(values) {
  return values[Math.floor(random() * values.length)]
}

const generatedAt = '2026-08-27T08:00:00.000Z'
const generatedCases = 50_000
const violations = {}
const samples = {}
function violation(code, sample) {
  violations[code] = (violations[code] ?? 0) + 1
  samples[code] ??= sample
}

try {
  const engine = await server.ssrLoadModule('/src/domain/coaching/index.ts')
  const {
    MAX_ROLLING_MUSCLE_SETS,
    MAX_SESSION_PRIMARY_MUSCLE_SETS,
    addPlannedSets,
    adaptPrescription,
    auditStrengthPrescriptionTime,
    calculateRollingMuscleVolume,
    prescriptionDurationSeconds,
    publishedExerciseCatalog,
    resolvePrescription,
  } = engine

  const supportedAges = Array.from({ length: 47 }, (_, index) => index + 18)
  const ages = [17, ...supportedAges, 65]
  const readinessStates = ['GREEN', 'YELLOW', 'ORANGE_RECOVERY', 'RED_STOP']
  const supportedReadinessStates = ['GREEN', 'YELLOW']
  const budgets = [10, 20, 30, 45, 60, 90]
  const experiences = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
  const goals = [
    'BODY_RECOMPOSITION',
    'FAT_LOSS',
    'MUSCLE_GAIN',
    'MAX_STRENGTH',
    'ENDURANCE',
    'SPEED_POWER',
    'GENERAL_FITNESS',
    'POSTURE_MOBILITY',
    'SPORT_PERFORMANCE',
  ]
  const equipmentProfiles = [
    { id: 'BODYWEIGHT', items: ['Kehonpaino'] },
    { id: 'BANDS', items: ['Kehonpaino', 'Vastuskuminauhat'] },
    { id: 'DUMBBELLS', items: ['Kehonpaino', 'Käsipainot'] },
    { id: 'MACHINES', items: ['Kehonpaino', 'Kuntosalilaitteet'] },
    {
      id: 'FULL_GYM',
      items: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet', 'Levytanko ja painot'],
    },
  ]
  const limitationTags = [
    undefined,
    'ACUTE_KNEE_PAIN',
    'ACUTE_BACK_PAIN',
    'ACUTE_SHOULDER_PAIN',
    'OVERHEAD_RESTRICTION',
  ]
  const historyCandidates = publishedExerciseCatalog
    .listExercises()
    .filter((item) => item.method === 'RESISTANCE')
  let allowedPrescriptionCount = 0
  let unexpectedBlockedCount = 0
  const expectedBlockedCount = {}
  const actualBlockedCount = {}
  let allowedAdaptationCount = 0
  let recoveryAdaptationCount = 0
  let unexpectedAdaptationBlockedCount = 0
  const expectedAdaptationBlockedCount = {}
  const actualAdaptationBlockedCount = {}
  const supportedPrescriptionCountByBudget = Object.fromEntries(
    budgets.map((budget) => [budget, 0]),
  )
  const supportedVariantCount = Object.fromEntries(
    ['FULL', 'LIGHT', 'COMPACT_10', 'COMPACT_20', 'COMPACT_30'].map((kind) => [kind, 0]),
  )
  const maximumCalculatedSecondsByBudget = Object.fromEntries(
    budgets.map((budget) => [budget, 0]),
  )
  const maximumUtilizationPercentByBudget = Object.fromEntries(
    budgets.map((budget) => [budget, 0]),
  )
  let timeBudgetViolationCount = 0
  let displayedDurationMismatchCount = 0
  let missingTimeBreakdownCount = 0
  let shortenedRestCount = 0
  let emptySupportedPrescriptionCount = 0
  const coverage = {
    age: Object.fromEntries(supportedAges.map((age) => [age, 0])),
    goal: Object.fromEntries(goals.map((goal) => [goal, 0])),
    experience: Object.fromEntries(experiences.map((experience) => [experience, 0])),
    readiness: Object.fromEntries(
      supportedReadinessStates.map((readiness) => [readiness, 0]),
    ),
    equipment: Object.fromEntries(equipmentProfiles.map((profile) => [profile.id, 0])),
  }
  function increment(counter, key) {
    counter[key] = (counter[key] ?? 0) + 1
  }
  function expectedBlockReason({
    age,
    readiness,
    healthBlocked,
    legacyLimitationsUnconfirmed,
  }) {
    if (healthBlocked) return 'HEALTH_ENGINE_NOT_AVAILABLE'
    if (readiness === 'RED_STOP') return 'READINESS_RED_STOP'
    if (legacyLimitationsUnconfirmed) return 'SAFETY_INFORMATION_INCOMPLETE'
    if (age < 18) return 'YOUTH_ENGINE_NOT_AVAILABLE'
    if (age >= 65) return 'OLDER_ADULT_ENGINE_NOT_AVAILABLE'
    if (readiness === 'ORANGE_RECOVERY') return 'READINESS_RECOVERY_ONLY'
    return null
  }

  const adaptationBaseline = resolvePrescription({
    sessionId: 'p0-adaptation-baseline',
    title: 'P0 adaptation baseline',
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
  let legacyAdaptationPrescription = null
  if (adaptationBaseline.status !== 'SUPPORTED') {
    violation('ADAPTATION_BASELINE_BLOCKED', adaptationBaseline)
  } else {
    legacyAdaptationPrescription = { ...adaptationBaseline.prescription }
    delete legacyAdaptationPrescription.schemaVersion
    delete legacyAdaptationPrescription.engineVersion
  }

  for (let index = 0; index < generatedCases; index += 1) {
    const age = pick(ages)
    const readiness = pick(readinessStates)
    const budget = pick(budgets)
    const experience = pick(experiences)
    const goal = pick(goals)
    const equipmentProfile = pick(equipmentProfiles)
    const equipment = equipmentProfile.items
    const limitationTag = pick(limitationTags)
    const healthBlocked = random() < 0.08
    const legacyLimitationsUnconfirmed = !limitationTag && random() < 0.05
    const historyExercise = pick(historyCandidates)
    const historyCount = Math.floor(random() * 17)
    const strengthHistory = Array.from({ length: historyCount }, (_, historyIndex) => ({
      exerciseCode: historyExercise.code,
      exerciseVersion: historyExercise.version,
      primaryMuscles: historyExercise.primaryMuscles,
      secondaryMuscles: historyExercise.secondaryMuscles,
      loadKg: null,
      repetitions: 10,
      rir: 3,
      completedAt: `2026-08-${String(26 - (historyIndex % 6)).padStart(2, '0')}T08:00:00.000Z`,
      pain: false,
      techniqueOk: true,
    }))
    const input = {
      sessionId: `p0-property-${index}`,
      title: 'P0 property',
      kind: 'STRENGTH',
      durationMinutes: budget,
      profile: {
        goal,
        experience,
        equipment,
        physicalLoad: 'MODERATE',
        minutesPerSession: budget,
        age,
        readiness,
        healthBlocked,
        generatedAt,
        limitations: legacyLimitationsUnconfirmed
          ? 'Vanha vahvistamaton rajoitetieto'
          : undefined,
        confirmedLimitationTags: limitationTag ? [limitationTag] : [],
        strengthHistory,
      },
    }
    const first = resolvePrescription(input)
    const second = resolvePrescription(input)
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      violation('NON_DETERMINISTIC', { index })
    }

    const safetyGateReasonCode = expectedBlockReason({
      age,
      readiness,
      healthBlocked,
      legacyLimitationsUnconfirmed,
    })
    let expectedReasonCode = safetyGateReasonCode
    if (
      !expectedReasonCode &&
      first.status === 'UNSUPPORTED' &&
      first.reasonCode === 'NO_SAFE_STRENGTH_DOSE_AVAILABLE' &&
      historyCount > 0
    ) {
      expectedReasonCode = 'NO_SAFE_STRENGTH_DOSE_AVAILABLE'
    }
    if (expectedReasonCode) increment(expectedBlockedCount, expectedReasonCode)
    if (first.status === 'UNSUPPORTED') {
      increment(actualBlockedCount, first.reasonCode)
      if (!expectedReasonCode) {
        unexpectedBlockedCount += 1
        violation('UNEXPECTED_PRESCRIPTION_BLOCK', {
          index,
          reasonCode: first.reasonCode,
          age,
          readiness,
          goal,
          experience,
          equipmentProfile: equipmentProfile.id,
        })
      } else if (first.reasonCode !== expectedReasonCode) {
        violation('UNEXPECTED_BLOCK_REASON', {
          index,
          expectedReasonCode,
          actualReasonCode: first.reasonCode,
        })
      }
    } else if (expectedReasonCode) {
      violation('SAFETY_OR_SCOPE_GATE_BYPASSED', {
        index,
        age,
        readiness,
        healthBlocked,
        legacyLimitationsUnconfirmed,
        expectedReasonCode,
      })
    }

    if (legacyAdaptationPrescription) {
      const adaptation = adaptPrescription(
        legacyAdaptationPrescription,
        {
          kind: 'FULL',
          durationMinutes: budget,
          volumeMultiplier: 1,
        },
        {
          age,
          readiness,
          healthBlocked,
          safetyInformationComplete: !legacyLimitationsUnconfirmed,
        },
      )
      const expectedAdaptationBlock =
        safetyGateReasonCode === 'READINESS_RECOVERY_ONLY' ? null : safetyGateReasonCode
      if (expectedAdaptationBlock) {
        increment(expectedAdaptationBlockedCount, expectedAdaptationBlock)
      }
      if (adaptation.status === 'UNSUPPORTED') {
        increment(actualAdaptationBlockedCount, adaptation.reasonCode)
        if (!expectedAdaptationBlock) {
          unexpectedAdaptationBlockedCount += 1
          violation('UNEXPECTED_ADAPTATION_BLOCK', {
            index,
            reasonCode: adaptation.reasonCode,
            age,
            readiness,
            healthBlocked,
            legacyLimitationsUnconfirmed,
          })
        } else if (adaptation.reasonCode !== expectedAdaptationBlock) {
          violation('UNEXPECTED_ADAPTATION_BLOCK_REASON', {
            index,
            expectedReasonCode: expectedAdaptationBlock,
            actualReasonCode: adaptation.reasonCode,
          })
        }
      } else if (expectedAdaptationBlock) {
        violation('ADAPTATION_SAFETY_GATE_BYPASSED', {
          index,
          age,
          readiness,
          healthBlocked,
          legacyLimitationsUnconfirmed,
          expectedReasonCode: expectedAdaptationBlock,
          adaptedKind: adaptation.prescription.kind,
        })
      } else if (readiness === 'ORANGE_RECOVERY') {
        if (adaptation.prescription.kind !== 'RECOVERY') {
          violation('ORANGE_STRENGTH_ADAPTATION_BYPASSED', {
            index,
            adaptedKind: adaptation.prescription.kind,
          })
        } else {
          recoveryAdaptationCount += 1
        }
      } else if (adaptation.prescription.kind !== 'STRENGTH') {
        violation('UNEXPECTED_ADAPTATION_KIND', {
          index,
          adaptedKind: adaptation.prescription.kind,
        })
      } else {
        allowedAdaptationCount += 1
      }
    }
    if (first.status !== 'SUPPORTED') continue

    const prescription = first.prescription
    if (prescription.exercises.length === 0) {
      emptySupportedPrescriptionCount += 1
      violation('EMPTY_SUPPORTED_PRESCRIPTION', {
        index,
        age,
        readiness,
        goal,
        experience,
        equipmentProfile: equipmentProfile.id,
        limitationTag,
        historyExercise: historyExercise.code,
        historyCount,
        budget,
      })
      continue
    }
    allowedPrescriptionCount += 1
    increment(supportedPrescriptionCountByBudget, budget)
    increment(coverage.age, age)
    increment(coverage.goal, goal)
    increment(coverage.experience, experience)
    increment(coverage.readiness, readiness)
    increment(coverage.equipment, equipmentProfile.id)
    const durationSeconds = prescriptionDurationSeconds(prescription)
    const timeAudit = auditStrengthPrescriptionTime(prescription)
    if (timeAudit.violations.includes('TIME_BUDGET_EXCEEDED')) {
      timeBudgetViolationCount += 1
    }
    if (timeAudit.violations.includes('DISPLAYED_DURATION_MISMATCH')) {
      displayedDurationMismatchCount += 1
    }
    if (
      timeAudit.violations.includes('TIME_BREAKDOWN_MISSING') ||
      timeAudit.violations.includes('TIME_BREAKDOWN_STALE')
    ) {
      missingTimeBreakdownCount += 1
    }
    if (timeAudit.violations.includes('REST_SHORTENED')) {
      shortenedRestCount += 1
    }
    for (const timeViolation of timeAudit.violations) {
      violation(timeViolation, { index, budget, durationSeconds })
    }
    maximumCalculatedSecondsByBudget[budget] = Math.max(
      maximumCalculatedSecondsByBudget[budget],
      durationSeconds,
    )
    maximumUtilizationPercentByBudget[budget] = Math.max(
      maximumUtilizationPercentByBudget[budget],
      Number(((durationSeconds / (budget * 60)) * 100).toFixed(2)),
    )
    if (durationSeconds > budget * 60) {
      violation('TIME_BUDGET_EXCEEDED', { index, budget, durationSeconds })
    }
    const variants = [
      {
        kind: 'FULL',
        timeBudgetMinutes: budget,
        durationMinutes: budget,
        volumeMultiplier: 1,
      },
      {
        kind: 'LIGHT',
        timeBudgetMinutes: budget,
        durationMinutes: budget,
        volumeMultiplier: 0.65,
      },
      {
        kind: 'COMPACT_10',
        timeBudgetMinutes: Math.min(budget, 10),
        durationMinutes: Math.min(budget, 10),
        volumeMultiplier: 0.35,
      },
      {
        kind: 'COMPACT_20',
        timeBudgetMinutes: Math.min(budget, 20),
        durationMinutes: Math.min(budget, 20),
        volumeMultiplier: 0.55,
      },
      {
        kind: 'COMPACT_30',
        timeBudgetMinutes: Math.min(budget, 30),
        durationMinutes: Math.min(budget, 30),
        volumeMultiplier: 0.75,
      },
    ]
    for (const workoutVariant of variants) {
      const adapted = adaptPrescription(prescription, workoutVariant, {
        age,
        readiness,
        healthBlocked: false,
        safetyInformationComplete: true,
      })
      if (adapted.status !== 'SUPPORTED') {
        violation('UNEXPECTED_TIME_VARIANT_BLOCK', {
          index,
          budget,
          variant: workoutVariant.kind,
          reasonCode: adapted.reasonCode,
        })
        continue
      }
      increment(supportedVariantCount, workoutVariant.kind)
      const variantAudit = auditStrengthPrescriptionTime(adapted.prescription)
      const variantBudget = workoutVariant.timeBudgetMinutes
      const variantSeconds = variantAudit.calculated.totalSeconds
      if (variantAudit.violations.includes('TIME_BUDGET_EXCEEDED')) {
        timeBudgetViolationCount += 1
      }
      if (variantAudit.violations.includes('DISPLAYED_DURATION_MISMATCH')) {
        displayedDurationMismatchCount += 1
      }
      if (
        variantAudit.violations.includes('TIME_BREAKDOWN_MISSING') ||
        variantAudit.violations.includes('TIME_BREAKDOWN_STALE')
      ) {
        missingTimeBreakdownCount += 1
      }
      if (variantAudit.violations.includes('REST_SHORTENED')) {
        shortenedRestCount += 1
      }
      for (const timeViolation of variantAudit.violations) {
        violation(timeViolation, {
          index,
          budget: variantBudget,
          variant: workoutVariant.kind,
          durationSeconds: variantSeconds,
        })
      }
      for (const exercise of adapted.prescription.exercises) {
        const source = prescription.exercises.find((item) => item.code === exercise.code)
        if (source && exercise.restSeconds < source.restSeconds) {
          shortenedRestCount += 1
          violation('REST_SHORTENED', {
            index,
            variant: workoutVariant.kind,
            exercise: exercise.code,
            sourceRestSeconds: source.restSeconds,
            adaptedRestSeconds: exercise.restSeconds,
          })
        }
      }
    }
    if (
      prescription.exercises.some(
        (exercise) =>
          !exercise.equipment.some((item) => equipment.includes(item)) ||
          (limitationTag &&
            publishedExerciseCatalog
              .getExercise(exercise.code)
              ?.contraindicationTags.includes(limitationTag)),
      )
    ) {
      violation('HARD_CONSTRAINT_BYPASSED', {
        index,
        equipment,
        limitationTag,
        selected: prescription.exercises.map((item) => item.code),
      })
    }
    if (
      prescription.exercises.some(
        (exercise) =>
          exercise.loadType === 'BAND' &&
          (/kg/u.test(exercise.loadLabelFi) ||
            /\d+(?:[.,]\d+)?\s*kg/u.test(exercise.loadGuidance)),
      )
    ) {
      violation('BAND_KILOGRAM_RECOMMENDATION', { index })
    }

    const rolling = calculateRollingMuscleVolume({
      sets: strengthHistory,
      at: generatedAt,
      catalog: publishedExerciseCatalog,
    })
    const sessionPrimary = {}
    for (const exercise of prescription.exercises) {
      const definition = publishedExerciseCatalog.getExercise(exercise.code)
      if (!definition) {
        violation('UNKNOWN_EXERCISE', { index, code: exercise.code })
        continue
      }
      addPlannedSets({
        exercise: definition,
        sets: exercise.sets,
        rollingVolume: rolling,
        sessionPrimaryVolume: sessionPrimary,
      })
    }
    if (Object.values(rolling).some((value) => value > MAX_ROLLING_MUSCLE_SETS)) {
      violation('ROLLING_MUSCLE_VOLUME_CAP_EXCEEDED', {
        index,
        rolling,
        historyExercise: historyExercise.code,
        historyCount,
      })
    }
    if (
      Object.values(sessionPrimary).some(
        (value) => value > MAX_SESSION_PRIMARY_MUSCLE_SETS,
      )
    ) {
      violation('SESSION_PRIMARY_VOLUME_CAP_EXCEEDED', { index, sessionPrimary })
    }
  }

  for (const [dimension, counts] of Object.entries(coverage)) {
    for (const [value, count] of Object.entries(counts)) {
      if (count === 0) violation('SUPPORTED_COVERAGE_MISSING', { dimension, value })
    }
  }
  if (allowedPrescriptionCount === 0) {
    violation('NO_ALLOWED_PRESCRIPTIONS', {})
  }
  if (allowedAdaptationCount === 0) {
    violation('NO_ALLOWED_ADAPTATIONS', {})
  }
  if (recoveryAdaptationCount === 0) {
    violation('NO_APPROVED_RECOVERY_ADAPTATIONS', {})
  }

  const result = {
    seedHex,
    generatedCases,
    allowedPrescriptionCount,
    expectedBlockedCount,
    actualBlockedCount,
    unexpectedBlockedCount,
    allowedAdaptationCount,
    recoveryAdaptationCount,
    expectedAdaptationBlockedCount,
    actualAdaptationBlockedCount,
    unexpectedAdaptationBlockedCount,
    timeAudit: {
      supportedPrescriptionCount: allowedPrescriptionCount,
      unsupportedCount: actualBlockedCount,
      supportedPrescriptionCountByBudget,
      supportedVariantCount,
      maximumCalculatedSecondsByBudget,
      maximumUtilizationPercentByBudget,
      timeBudgetViolationCount,
      displayedDurationMismatchCount,
      missingTimeBreakdownCount,
      shortenedRestCount,
      emptySupportedPrescriptionCount,
    },
    supportedCoverage: coverage,
    violationCounts: violations,
    violationSamples: samples,
    passed: Object.keys(violations).length === 0,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.passed) process.exitCode = 1
} finally {
  await server.close()
}
