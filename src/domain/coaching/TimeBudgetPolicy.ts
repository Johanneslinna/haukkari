import type {
  ExerciseLoadType,
  ExercisePrescription,
  PrescribedSession,
  PrescriptionTimeBreakdown,
  StrengthSetsDose,
} from './types'

export const ADULT_STRENGTH_TIME_POLICY_VERSION = 'adult-strength-time-1.0.0'

export const STRENGTH_TIME_REASON_CODES = {
  ACCESSORY_REMOVED: 'TIME_ACCESSORY_REMOVED',
  ACCESSORY_SET_REDUCED: 'TIME_ACCESSORY_SET_REDUCED',
  MAIN_SET_REDUCED: 'TIME_MAIN_SET_REDUCED',
  COMPACT_VARIANT: 'TIME_COMPACT_VARIANT',
  LEGACY_REAUTHORIZED: 'TIME_LEGACY_REAUTHORIZED',
  MINIMUM_SAFE_DOSE_UNAVAILABLE: 'TIME_MINIMUM_SAFE_DOSE_UNAVAILABLE',
} as const

export const STRENGTH_TIME_INVARIANT_CODES = {
  BUDGET_EXCEEDED: 'TIME_BUDGET_EXCEEDED',
  DISPLAYED_DURATION_MISMATCH: 'DISPLAYED_DURATION_MISMATCH',
  TIME_BREAKDOWN_MISSING: 'TIME_BREAKDOWN_MISSING',
  TIME_BREAKDOWN_STALE: 'TIME_BREAKDOWN_STALE',
  REST_SHORTENED: 'REST_SHORTENED',
  TRANSITION_MISSING: 'TRANSITION_TIME_MISSING',
  EQUIPMENT_SETUP_MISSING: 'EQUIPMENT_SETUP_TIME_MISSING',
  WORK_DURATION_MISSING: 'WORK_DURATION_MISSING',
  EMPTY_PRESCRIPTION: 'EMPTY_SUPPORTED_PRESCRIPTION',
} as const

export type StrengthTimeBudgetPolicy = {
  version: string
  workSetSeconds: number
  exerciseWarmupSetSeconds: number
  exerciseWarmupRecoverySeconds: number
  transitionSeconds: number
  minimumWorkSetRestSeconds: number
  equipmentSetupSeconds: Record<ExerciseLoadType, number>
  bufferRatio: number
  minimumBufferSeconds: number
  warmupSecondsForBudget: (timeBudgetMinutes: number) => number
  cooldownSecondsForBudget: (timeBudgetMinutes: number) => number
  minimumExerciseCountForBudget: (timeBudgetMinutes: number) => number
}

export const ADULT_STRENGTH_TIME_POLICY: StrengthTimeBudgetPolicy = {
  version: ADULT_STRENGTH_TIME_POLICY_VERSION,
  workSetSeconds: 60,
  exerciseWarmupSetSeconds: 45,
  exerciseWarmupRecoverySeconds: 45,
  transitionSeconds: 25,
  minimumWorkSetRestSeconds: 60,
  equipmentSetupSeconds: {
    EXTERNAL_KG: 60,
    DUMBBELL_KG_EACH: 45,
    MACHINE_KG: 45,
    BAND: 30,
    BODYWEIGHT: 20,
    LEVEL: 20,
    NONE: 15,
  },
  bufferRatio: 0.1,
  minimumBufferSeconds: 30,
  warmupSecondsForBudget(timeBudgetMinutes) {
    if (timeBudgetMinutes <= 10) return 120
    if (timeBudgetMinutes <= 20) return 180
    if (timeBudgetMinutes <= 30) return 240
    if (timeBudgetMinutes <= 45) return 300
    if (timeBudgetMinutes <= 60) return 360
    return 480
  },
  cooldownSecondsForBudget(timeBudgetMinutes) {
    if (timeBudgetMinutes <= 20) return 60
    if (timeBudgetMinutes <= 30) return 90
    if (timeBudgetMinutes <= 45) return 120
    if (timeBudgetMinutes <= 60) return 180
    return 240
  },
  minimumExerciseCountForBudget(timeBudgetMinutes) {
    if (timeBudgetMinutes <= 10) return 2
    if (timeBudgetMinutes <= 20) return 3
    if (timeBudgetMinutes <= 30) return 4
    return 5
  },
}

function strengthDose(exercise: ExercisePrescription): StrengthSetsDose {
  if (exercise.dose?.kind === 'STRENGTH_SETS') return exercise.dose
  return {
    kind: 'STRENGTH_SETS',
    sets: Math.max(1, exercise.sets),
    repetitions: exercise.repetitions ?? 'hallittu työosuus',
    restSeconds: Math.max(0, exercise.restSeconds),
    targetRpe: exercise.targetRpe,
    targetRir: exercise.targetRir,
  }
}

function prescriptionExercises(prescription: PrescribedSession) {
  return prescription.blocks?.length ? prescription.blocks : prescription.exercises
}

export function estimatePrescriptionTime(
  prescription: PrescribedSession,
  policy: StrengthTimeBudgetPolicy = ADULT_STRENGTH_TIME_POLICY,
): PrescriptionTimeBreakdown {
  const exercises = prescriptionExercises(prescription)
  const timeBudgetMinutes =
    prescription.timeBudgetMinutes ?? Math.max(1, prescription.durationMinutes)
  const warmupSeconds =
    prescription.warmupMinutes === undefined
      ? policy.warmupSecondsForBudget(timeBudgetMinutes)
      : Math.max(0, Math.round(prescription.warmupMinutes * 60))
  const cooldownSeconds =
    prescription.cooldownMinutes === undefined
      ? policy.cooldownSecondsForBudget(timeBudgetMinutes)
      : Math.max(0, Math.round(prescription.cooldownMinutes * 60))
  let exerciseWarmupSeconds = 0
  let workSeconds = 0
  let restSeconds = 0
  let equipmentSetupSeconds = 0

  for (const exercise of exercises) {
    const dose = strengthDose(exercise)
    const warmupSets = Math.max(0, exercise.warmupSets ?? 0)
    const workSetSeconds = Math.max(
      1,
      exercise.estimatedWorkSetSeconds ?? policy.workSetSeconds,
    )
    exerciseWarmupSeconds += warmupSets * policy.exerciseWarmupSetSeconds
    workSeconds += dose.sets * workSetSeconds
    restSeconds += Math.max(0, dose.sets - 1) * dose.restSeconds
    if (warmupSets > 0 && dose.sets > 0) {
      restSeconds += warmupSets * policy.exerciseWarmupRecoverySeconds
    }
    equipmentSetupSeconds += policy.equipmentSetupSeconds[exercise.loadType]
  }

  const transitionSeconds = Math.max(0, exercises.length - 1) * policy.transitionSeconds
  const subtotalSeconds =
    warmupSeconds +
    exerciseWarmupSeconds +
    workSeconds +
    restSeconds +
    transitionSeconds +
    equipmentSetupSeconds +
    cooldownSeconds
  const bufferSeconds = Math.max(
    policy.minimumBufferSeconds,
    Math.ceil(subtotalSeconds * policy.bufferRatio),
  )

  return {
    warmupSeconds,
    exerciseWarmupSeconds,
    workSeconds,
    restSeconds,
    transitionSeconds,
    equipmentSetupSeconds,
    cooldownSeconds,
    bufferSeconds,
    totalSeconds: subtotalSeconds + bufferSeconds,
    policyVersion: policy.version,
  }
}

export function refreshStrengthPrescriptionTimeEstimate(
  prescription: PrescribedSession,
  policy: StrengthTimeBudgetPolicy = ADULT_STRENGTH_TIME_POLICY,
): PrescribedSession {
  const timeBreakdown = estimatePrescriptionTime(prescription, policy)
  return {
    ...prescription,
    durationMinutes: Math.ceil(timeBreakdown.totalSeconds / 60),
    calculatedTotalSeconds: timeBreakdown.totalSeconds,
    timePolicyVersion: timeBreakdown.policyVersion,
    timeBreakdown,
  }
}

export function auditStrengthPrescriptionTime(
  prescription: PrescribedSession,
  policy: StrengthTimeBudgetPolicy = ADULT_STRENGTH_TIME_POLICY,
) {
  const violations: string[] = []
  const exercises = prescriptionExercises(prescription)
  const calculated = estimatePrescriptionTime(prescription, policy)
  const budgetSeconds =
    (prescription.timeBudgetMinutes ?? prescription.durationMinutes) * 60
  if (exercises.length === 0) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.EMPTY_PRESCRIPTION)
  }
  if (!prescription.timeBreakdown || !prescription.timePolicyVersion) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.TIME_BREAKDOWN_MISSING)
  } else if (
    prescription.timePolicyVersion !== policy.version ||
    JSON.stringify(prescription.timeBreakdown) !== JSON.stringify(calculated) ||
    prescription.calculatedTotalSeconds !== calculated.totalSeconds
  ) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.TIME_BREAKDOWN_STALE)
  }
  if (calculated.totalSeconds > budgetSeconds) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.BUDGET_EXCEEDED)
  }
  if (prescription.durationMinutes !== Math.ceil(calculated.totalSeconds / 60)) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.DISPLAYED_DURATION_MISMATCH)
  }
  if (
    exercises.some((exercise) => {
      const dose = strengthDose(exercise)
      return dose.sets > 1 && dose.restSeconds < policy.minimumWorkSetRestSeconds
    })
  ) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.REST_SHORTENED)
  }
  if (exercises.length > 1 && calculated.transitionSeconds <= 0) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.TRANSITION_MISSING)
  }
  if (exercises.length > 0 && calculated.equipmentSetupSeconds <= 0) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.EQUIPMENT_SETUP_MISSING)
  }
  if (
    calculated.workSeconds <= 0 ||
    exercises.some((exercise) => (exercise.estimatedWorkSetSeconds ?? 0) <= 0)
  ) {
    violations.push(STRENGTH_TIME_INVARIANT_CODES.WORK_DURATION_MISSING)
  }
  return { calculated, violations: unique(violations) }
}

function cloneExercise(
  exercise: ExercisePrescription,
  policy: StrengthTimeBudgetPolicy,
): ExercisePrescription {
  return {
    ...exercise,
    dose: exercise.dose ? { ...exercise.dose } : exercise.dose,
    warmupSets: exercise.warmupSets ?? 0,
    estimatedWorkSetSeconds: exercise.estimatedWorkSetSeconds ?? policy.workSetSeconds,
  }
}

function setExerciseSets(exercise: ExercisePrescription, sets: number) {
  exercise.sets = sets
  if (exercise.dose?.kind === 'STRENGTH_SETS') {
    exercise.dose = { ...exercise.dose, sets }
  }
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

export type StrengthTimeFitResult =
  | {
      status: 'SUPPORTED'
      prescription: PrescribedSession
      reasonCodes: string[]
    }
  | {
      status: 'UNSUPPORTED'
      reasonCode: typeof STRENGTH_TIME_REASON_CODES.MINIMUM_SAFE_DOSE_UNAVAILABLE
      reasonCodes: string[]
      timeBreakdown?: PrescriptionTimeBreakdown
    }

function hasAuditableStrengthTiming(
  exercise: ExercisePrescription,
  policy: StrengthTimeBudgetPolicy,
) {
  const dose = exercise.dose
  const sets = dose?.kind === 'STRENGTH_SETS' ? dose.sets : exercise.sets
  const restSeconds =
    dose?.kind === 'STRENGTH_SETS' ? dose.restSeconds : exercise.restSeconds
  return (
    (!dose || dose.kind === 'STRENGTH_SETS') &&
    Number.isInteger(sets) &&
    sets >= 1 &&
    Number.isFinite(restSeconds) &&
    restSeconds >= 0 &&
    (exercise.warmupSets === undefined ||
      (Number.isInteger(exercise.warmupSets) && exercise.warmupSets >= 0)) &&
    (exercise.estimatedWorkSetSeconds === undefined ||
      (Number.isFinite(exercise.estimatedWorkSetSeconds) &&
        exercise.estimatedWorkSetSeconds > 0)) &&
    Object.hasOwn(policy.equipmentSetupSeconds, exercise.loadType)
  )
}

export function fitStrengthPrescriptionToTimeBudget(input: {
  prescription: PrescribedSession
  timeBudgetMinutes: number
  policy?: StrengthTimeBudgetPolicy
  initialReasonCodes?: string[]
}): StrengthTimeFitResult {
  const policy = input.policy ?? ADULT_STRENGTH_TIME_POLICY
  const sourceExercises = prescriptionExercises(input.prescription)
  if (
    !Number.isFinite(input.timeBudgetMinutes) ||
    input.timeBudgetMinutes <= 0 ||
    sourceExercises.length === 0 ||
    sourceExercises.some((exercise) => !hasAuditableStrengthTiming(exercise, policy))
  ) {
    return {
      status: 'UNSUPPORTED',
      reasonCode: STRENGTH_TIME_REASON_CODES.MINIMUM_SAFE_DOSE_UNAVAILABLE,
      reasonCodes: [STRENGTH_TIME_REASON_CODES.MINIMUM_SAFE_DOSE_UNAVAILABLE],
    }
  }
  const timeBudgetMinutes = Math.max(1, Math.floor(input.timeBudgetMinutes))
  const legacyReauthorization =
    input.prescription.schemaVersion !== 2 ||
    input.prescription.timePolicyVersion !== policy.version ||
    !input.prescription.timeBreakdown
  let exercises = sourceExercises.map((exercise) => cloneExercise(exercise, policy))
  if (legacyReauthorization && exercises.length > 0) {
    exercises[0] = {
      ...exercises[0]!,
      warmupSets: Math.max(1, exercises[0]!.warmupSets ?? 0),
    }
  }
  const reasonCodes = [
    ...(input.prescription.timeAdjustmentReasonCodes ?? []),
    ...(input.initialReasonCodes ?? []),
    ...(legacyReauthorization ? [STRENGTH_TIME_REASON_CODES.LEGACY_REAUTHORIZED] : []),
  ]
  const original = exercises.map((exercise) => ({
    code: exercise.code,
    sets: exercise.sets,
  }))
  const minimumExerciseCount = Math.min(
    exercises.length,
    policy.minimumExerciseCountForBudget(timeBudgetMinutes),
  )
  const sessionWith = (nextExercises: ExercisePrescription[]): PrescribedSession => ({
    ...input.prescription,
    timeBudgetMinutes,
    warmupMinutes: policy.warmupSecondsForBudget(timeBudgetMinutes) / 60,
    cooldownMinutes: policy.cooldownSecondsForBudget(timeBudgetMinutes) / 60,
    exercises: nextExercises,
    blocks: nextExercises,
  })
  const estimate = () => estimatePrescriptionTime(sessionWith(exercises), policy)
  const exceedsBudget = () => estimate().totalSeconds > timeBudgetMinutes * 60

  while (exceedsBudget()) {
    if (exercises.length <= minimumExerciseCount) break
    const removableIndex = exercises.findLastIndex((exercise) => !exercise.keyExercise)
    if (removableIndex < 0) break
    exercises.splice(removableIndex, 1)
    reasonCodes.push(STRENGTH_TIME_REASON_CODES.ACCESSORY_REMOVED)
  }
  while (exceedsBudget()) {
    const reducible = [...exercises]
      .reverse()
      .find((exercise) => !exercise.keyExercise && exercise.sets > 1)
    if (!reducible) break
    setExerciseSets(reducible, reducible.sets - 1)
    reasonCodes.push(STRENGTH_TIME_REASON_CODES.ACCESSORY_SET_REDUCED)
  }
  while (exceedsBudget()) {
    const reducible = [...exercises]
      .reverse()
      .find((exercise) => exercise.keyExercise && exercise.sets > 1)
    if (!reducible) break
    setExerciseSets(reducible, reducible.sets - 1)
    reasonCodes.push(STRENGTH_TIME_REASON_CODES.MAIN_SET_REDUCED)
  }

  const timeBreakdown = estimate()
  if (exercises.length === 0 || timeBreakdown.totalSeconds > timeBudgetMinutes * 60) {
    return {
      status: 'UNSUPPORTED',
      reasonCode: STRENGTH_TIME_REASON_CODES.MINIMUM_SAFE_DOSE_UNAVAILABLE,
      reasonCodes: unique([
        ...reasonCodes,
        STRENGTH_TIME_REASON_CODES.MINIMUM_SAFE_DOSE_UNAVAILABLE,
      ]),
      timeBreakdown,
    }
  }

  const uniqueReasonCodes = unique(reasonCodes)
  const adjusted = exercises.map((exercise) => ({
    code: exercise.code,
    sets: exercise.sets,
  }))
  const prescription: PrescribedSession = refreshStrengthPrescriptionTimeEstimate(
    {
      ...sessionWith(exercises),
      timeAdjustmentReasonCodes: uniqueReasonCodes,
      decisionTrace: {
        ...input.prescription.decisionTrace,
        ruleIds: unique([
          ...(input.prescription.decisionTrace.ruleIds ?? []),
          policy.version,
          ...uniqueReasonCodes,
        ]),
        rules: [
          ...input.prescription.decisionTrace.rules,
          ...uniqueReasonCodes.map((reasonCode) => ({
            ruleId: reasonCode,
            outcome: 'MODIFY' as const,
            message:
              'Voimaharjoituksen sisältö sovitettiin versionoituun aikabudjettiin.',
            evidenceIds: ['APP-KEY-DOSE-RULE'],
          })),
        ],
        adaptations:
          JSON.stringify(original) === JSON.stringify(adjusted)
            ? input.prescription.decisionTrace.adaptations
            : [
                ...(input.prescription.decisionTrace.adaptations ?? []),
                { original, adjusted, reasonCodes: uniqueReasonCodes },
              ],
      },
    },
    policy,
  )
  return { status: 'SUPPORTED', prescription, reasonCodes: uniqueReasonCodes }
}
