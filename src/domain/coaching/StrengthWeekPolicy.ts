import type { ExerciseCatalog } from './content/TrainingContent'
import { publishedExerciseCatalog } from './content/TrainingContent'
import type { AdultResistanceSetHistory } from './AdultResistanceEngine'
import {
  MAX_ROLLING_MUSCLE_SETS,
  addPlannedSets,
  calculatePlannedMuscleVolume,
  calculateRollingMuscleVolume,
  maximumAdditionalSets,
  mergeMuscleVolume,
  type MuscleVolume,
} from './StrengthVolumePolicy'
import {
  fitStrengthPrescriptionToTimeBudget,
  refreshStrengthPrescriptionTimeEstimate,
} from './TimeBudgetPolicy'
import type {
  ExperienceLevel,
  GoalType,
  PrescribedSession,
  StrengthMovementPattern,
  StrengthWeekContext,
  StrengthWeekPlan,
  StrengthWeekSessionRole,
} from './types'

export const STRENGTH_WEEK_POLICY_VERSION = 'adult-strength-week-1.0.0'

export const STRENGTH_WEEK_REASON_CODES = {
  POLICY_APPLIED: 'STRENGTH_WEEK_POLICY_APPLIED',
  ONE_DAY_FULL_BODY: 'ONE_DAY_FULL_BODY_PARTIAL_COVERAGE',
  TWO_DAY_AB: 'TWO_DAY_FULL_BODY_AB',
  THREE_DAY_ABC: 'THREE_DAY_FULL_BODY_ABC',
  FOUR_DAY_UPPER_LOWER: 'FOUR_DAY_UPPER_LOWER_SPLIT',
  BEGINNER_FREQUENCY_CAPPED: 'BEGINNER_FREQUENCY_CAPPED_AT_THREE',
  RETURNING_FREQUENCY_CAPPED: 'RETURNING_FREQUENCY_CAPPED_AT_THREE',
  SELECTED_FREQUENCY_CAPPED: 'SELECTED_FREQUENCY_CAPPED_AT_FOUR',
  TWO_EXPOSURES_TARGET: 'TWO_EXPOSURES_PER_PATTERN_TARGET',
  PULL_EQUIPMENT_REQUIRED: 'PULL_PATTERN_EQUIPMENT_REQUIRED',
  EXTERNAL_VOLUME_UNKNOWN: 'EXTERNAL_STRENGTH_VOLUME_UNKNOWN',
  FIXED_STRENGTH_COUNTS: 'FIXED_STRENGTH_COUNTS_AS_EXPOSURE',
  COMPLETED_VOLUME_COUNTED: 'COMPLETED_VOLUME_COUNTED_ONCE',
  PLANNED_VOLUME_COUNTED: 'PLANNED_VOLUME_COUNTED_ONCE',
  ROLLING_CAP_ENFORCED: 'ROLLING_SEVEN_DAY_MUSCLE_CAP_ENFORCED',
  SESSION_CAP_ENFORCED: 'SESSION_PRIMARY_MUSCLE_CAP_ENFORCED',
  SET_PROGRESSION_ALLOWED: 'SET_PROGRESSION_ALLOWED',
  SET_PROGRESSION_BLOCKED: 'SET_PROGRESSION_BLOCKED',
  MISSED_NOT_DOUBLED: 'MISSED_SESSION_NOT_DOUBLED',
  COVERAGE_INCOMPLETE: 'MOVEMENT_PATTERN_COVERAGE_INCOMPLETE',
  SAME_BLUEPRINT: 'SAME_WEEK_BLUEPRINT_PRESERVED',
  WEEKLY_COVERAGE: 'WEEKLY_MOVEMENT_PATTERN_COVERAGE',
  WEEKLY_TARGET: 'WEEKLY_VOLUME_TARGET',
  FULLY_SUPPORTED: 'STRENGTH_WEEK_FULLY_SUPPORTED',
  NO_SAFE_SESSION: 'NO_SAFE_STRENGTH_DOSE_AVAILABLE',
  BELOW_TARGET_TIME: 'WEEKLY_VOLUME_BELOW_TARGET_TIME_LIMITED',
  BELOW_TARGET_EQUIPMENT: 'WEEKLY_VOLUME_BELOW_TARGET_EQUIPMENT_LIMITED',
  BELOW_TARGET_CONSTRAINT: 'WEEKLY_VOLUME_TARGET_INCOMPLETE',
  FREQUENCY_THREE: 'STRENGTH_FREQUENCY_CAPPED_AT_THREE',
  FREQUENCY_FOUR: 'STRENGTH_FREQUENCY_CAPPED_AT_FOUR',
  MUSCLE_EXPOSURE_CAPPED: 'MUSCLE_EXPOSURE_CAPPED',
  ROLLING_VOLUME_CAP: 'ROLLING_SEVEN_DAY_VOLUME_CAP',
  SET_PROGRESSION_WITHHELD: 'SET_PROGRESSION_WITHHELD',
  MISSED_SESSION_NOT_DOUBLED: 'MISSED_SESSION_NOT_DOUBLED',
  VOLUME_FILLED: 'WEEKLY_VOLUME_FILLED_WITH_REMAINING_SAFE_TIME',
} as const

const REQUIRED_PATTERNS: readonly StrengthMovementPattern[] = [
  'SQUAT',
  'HINGE',
  'HORIZONTAL_PUSH',
  'HORIZONTAL_PULL',
  'CORE',
]

const CANONICAL_MUSCLES = [
  'quadriceps',
  'gluteals',
  'hamstrings',
  'chest',
  'triceps',
  'latissimus',
  'upper back',
  'trunk',
] as const

export type StrengthWeekGoalRange = {
  minimumSetsPerMuscle: number
  targetSetsPerMuscle: number
}

export type StrengthWeekBlueprint = {
  policyVersion: typeof STRENGTH_WEEK_POLICY_VERSION
  weekAnchorDate: string
  targetSessions: number
  appSessionCount: number
  fixedStrengthExposureCount: number
  completedStrengthExposureCount: number
  roles: StrengthWeekSessionRole[]
  goalRange: StrengthWeekGoalRange
  completedVolume: MuscleVolume
  completedMovementPatternCoverage: StrengthMovementPattern[]
  externalStrengthVolumeUnknown: boolean
  bodyweightPullUnsupported: boolean
  returning: boolean
  generatedAt: string
  reasonCodes: string[]
}

export type StrengthWeekMaterializationState = {
  plannedVolume: MuscleVolume
  movementPatternCoverage: StrengthMovementPattern[]
  setProgressionVolume: MuscleVolume
  materializedSessionCount: number
}

function validAnchor(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  )
}

export function strengthGoalRange(
  goal: GoalType,
  trainingContinuityConfirmed = false,
): StrengthWeekGoalRange {
  if (goal === 'MUSCLE_GAIN') {
    return trainingContinuityConfirmed
      ? { minimumSetsPerMuscle: 8, targetSetsPerMuscle: 12 }
      : { minimumSetsPerMuscle: 4, targetSetsPerMuscle: 8 }
  }
  if (goal === 'MAX_STRENGTH') {
    return trainingContinuityConfirmed
      ? { minimumSetsPerMuscle: 6, targetSetsPerMuscle: 10 }
      : { minimumSetsPerMuscle: 4, targetSetsPerMuscle: 8 }
  }
  return { minimumSetsPerMuscle: 4, targetSetsPerMuscle: 8 }
}

function frequencyLimit(experience: ExperienceLevel, returning: boolean) {
  if (experience === 'BEGINNER' || returning) return 3
  return 4
}

function requestedFrequency(
  goal: GoalType,
  availableDays: number,
  hasHistory: boolean,
  experience: ExperienceLevel,
  returning: boolean,
) {
  if (goal === 'MAX_STRENGTH' || goal === 'MUSCLE_GAIN') {
    if (!hasHistory) return Math.min(2, Math.max(1, availableDays))
    if (experience === 'BEGINNER' || returning)
      return Math.min(3, Math.max(2, availableDays))
    return Math.min(4, Math.max(2, availableDays))
  }
  return 2
}

function rolesForFrequency(
  frequency: number,
  experience: ExperienceLevel,
  returning: boolean,
): StrengthWeekSessionRole[] {
  if (frequency <= 1) return frequency === 1 ? ['FULL_BODY'] : []
  if (frequency === 2) return ['FULL_BODY_A', 'FULL_BODY_B']
  if (frequency === 3) return ['FULL_BODY_A', 'FULL_BODY_B', 'FULL_BODY_C']
  if (experience !== 'BEGINNER' && !returning) {
    return ['UPPER_A', 'LOWER_A', 'UPPER_B', 'LOWER_B']
  }
  return ['FULL_BODY_A', 'FULL_BODY_B', 'FULL_BODY_C']
}

export function movementPatternsForRole(
  role: StrengthWeekSessionRole,
  availableMinutes: number,
): string[] {
  if (availableMinutes <= 10) {
    if (role === 'FULL_BODY_A' || role === 'FULL_BODY')
      return ['SQUAT', 'HORIZONTAL_PULL']
    if (role === 'FULL_BODY_B') return ['HINGE', 'HORIZONTAL_PUSH']
  }
  if (availableMinutes <= 20) {
    if (role === 'UPPER_A')
      return ['HORIZONTAL_PUSH', 'HORIZONTAL_PULL', 'ANTI_EXTENSION']
    if (role === 'UPPER_B') return ['HORIZONTAL_PULL', 'HORIZONTAL_PUSH', 'ANTI_ROTATION']
  }
  const patterns: Record<StrengthWeekSessionRole, string[]> = {
    FULL_BODY: ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL', 'ANTI_EXTENSION'],
    FULL_BODY_A: ['SQUAT', 'HORIZONTAL_PULL', 'HORIZONTAL_PUSH', 'ANTI_EXTENSION'],
    FULL_BODY_B: ['HINGE', 'HORIZONTAL_PULL', 'HORIZONTAL_PUSH', 'ANTI_ROTATION'],
    FULL_BODY_C: ['SINGLE_LEG', 'HINGE', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL'],
    UPPER_A: ['HORIZONTAL_PUSH', 'HORIZONTAL_PULL', 'ANTI_EXTENSION'],
    LOWER_A: ['SQUAT', 'HINGE', 'SINGLE_LEG'],
    UPPER_B: ['HORIZONTAL_PULL', 'HORIZONTAL_PUSH', 'ANTI_ROTATION'],
    LOWER_B: ['HINGE', 'SQUAT', 'SINGLE_LEG'],
  }
  const maximumMovements =
    availableMinutes <= 10
      ? 2
      : availableMinutes <= 20
        ? 3
        : availableMinutes <= 30
          ? 5
          : 6
  return patterns[role].slice(0, maximumMovements)
}

function patternFromCategory(category: string): StrengthMovementPattern | null {
  if (category === 'SQUAT' || category === 'SINGLE_LEG') return 'SQUAT'
  if (category === 'HINGE') return 'HINGE'
  if (category === 'HORIZONTAL_PUSH' || category === 'VERTICAL_PUSH')
    return 'HORIZONTAL_PUSH'
  if (category === 'HORIZONTAL_PULL' || category === 'VERTICAL_PULL')
    return 'HORIZONTAL_PULL'
  if (category === 'ANTI_EXTENSION' || category === 'ANTI_ROTATION') return 'CORE'
  return null
}

function goalVolume(goalRange: StrengthWeekGoalRange, volume: Readonly<MuscleVolume>) {
  return Object.fromEntries(
    CANONICAL_MUSCLES.map((muscle) => [
      muscle,
      Math.max(0, goalRange.minimumSetsPerMuscle - (volume[muscle] ?? 0)),
    ]),
  )
}

function capRemaining(volume: Readonly<MuscleVolume>) {
  return Object.fromEntries(
    CANONICAL_MUSCLES.map((muscle) => [
      muscle,
      Math.max(0, MAX_ROLLING_MUSCLE_SETS - (volume[muscle] ?? 0)),
    ]),
  )
}

export function createStrengthWeekBlueprint(input: {
  weekAnchorDate: string
  goal: GoalType
  experience: ExperienceLevel
  availableAppDays: number
  fixedStrengthExposureCount: number
  fixedStrengthVolumeKnown: boolean
  returning: boolean
  equipment: readonly string[]
  history: readonly AdultResistanceSetHistory[]
  trainingContinuityConfirmed: boolean
  generatedAt: string
  catalog?: ExerciseCatalog
}): StrengthWeekBlueprint {
  if (!validAnchor(input.weekAnchorDate)) throw new Error('INVALID_STRENGTH_WEEK_ANCHOR')
  const catalog = input.catalog ?? publishedExerciseCatalog
  const completedVolume = calculateRollingMuscleVolume({
    sets: input.history,
    at: input.generatedAt,
    catalog,
  })
  const generatedAtMs = Date.parse(input.generatedAt)
  const completedStrengthExposureCount = new Set(
    input.history
      .filter((row) => {
        const ageDays = (generatedAtMs - Date.parse(row.completedAt)) / 86_400_000
        return row.sessionId && ageDays >= 0 && ageDays <= 7
      })
      .map((row) => row.sessionId!),
  ).size
  const completedMovementPatternCoverage = [
    ...new Set(
      input.history.flatMap((row) =>
        (row.movementPatterns ?? []).flatMap((pattern) => {
          const normalized = patternFromCategory(pattern)
          return normalized ? [normalized] : []
        }),
      ),
    ),
  ] as StrengthMovementPattern[]
  const maximumFrequency = frequencyLimit(input.experience, input.returning)
  const requested = requestedFrequency(
    input.goal,
    input.availableAppDays + input.fixedStrengthExposureCount,
    input.trainingContinuityConfirmed,
    input.experience,
    input.returning,
  )
  const targetSessions = Math.min(
    4,
    maximumFrequency,
    Math.max(
      1,
      Math.min(requested, input.availableAppDays + input.fixedStrengthExposureCount),
    ),
  )
  const appSessionCount = Math.max(
    0,
    Math.min(input.availableAppDays, targetSessions - input.fixedStrengthExposureCount),
  )
  const reasonCodes: string[] = [
    STRENGTH_WEEK_REASON_CODES.POLICY_APPLIED,
    STRENGTH_WEEK_REASON_CODES.TWO_EXPOSURES_TARGET,
    STRENGTH_WEEK_REASON_CODES.COMPLETED_VOLUME_COUNTED,
    STRENGTH_WEEK_REASON_CODES.WEEKLY_TARGET,
    maximumFrequency === 3
      ? STRENGTH_WEEK_REASON_CODES.FREQUENCY_THREE
      : STRENGTH_WEEK_REASON_CODES.FREQUENCY_FOUR,
  ]
  if (targetSessions === 1) reasonCodes.push(STRENGTH_WEEK_REASON_CODES.ONE_DAY_FULL_BODY)
  if (targetSessions === 2) reasonCodes.push(STRENGTH_WEEK_REASON_CODES.TWO_DAY_AB)
  if (targetSessions === 3) reasonCodes.push(STRENGTH_WEEK_REASON_CODES.THREE_DAY_ABC)
  if (targetSessions === 4)
    reasonCodes.push(STRENGTH_WEEK_REASON_CODES.FOUR_DAY_UPPER_LOWER)
  if (input.experience === 'BEGINNER' && requested > 3) {
    reasonCodes.push(STRENGTH_WEEK_REASON_CODES.BEGINNER_FREQUENCY_CAPPED)
  }
  if (input.returning)
    reasonCodes.push(STRENGTH_WEEK_REASON_CODES.RETURNING_FREQUENCY_CAPPED)
  if (input.availableAppDays + input.fixedStrengthExposureCount > 4) {
    reasonCodes.push(STRENGTH_WEEK_REASON_CODES.SELECTED_FREQUENCY_CAPPED)
  }
  if (input.fixedStrengthExposureCount > 0)
    reasonCodes.push(STRENGTH_WEEK_REASON_CODES.FIXED_STRENGTH_COUNTS)
  const externalStrengthVolumeUnknown =
    input.fixedStrengthExposureCount > 0 && !input.fixedStrengthVolumeKnown
  if (externalStrengthVolumeUnknown)
    reasonCodes.push(STRENGTH_WEEK_REASON_CODES.EXTERNAL_VOLUME_UNKNOWN)
  const normalizedEquipment = input.equipment.map((value) =>
    value.toLocaleLowerCase('fi-FI'),
  )
  const bodyweightPullUnsupported =
    normalizedEquipment.length === 0 ||
    normalizedEquipment.every((value) => value.includes('kehonpain'))
  if (bodyweightPullUnsupported)
    reasonCodes.push(STRENGTH_WEEK_REASON_CODES.PULL_EQUIPMENT_REQUIRED)
  return {
    policyVersion: STRENGTH_WEEK_POLICY_VERSION,
    weekAnchorDate: input.weekAnchorDate,
    targetSessions,
    appSessionCount,
    fixedStrengthExposureCount: input.fixedStrengthExposureCount,
    completedStrengthExposureCount,
    roles: rolesForFrequency(appSessionCount, input.experience, input.returning),
    goalRange: strengthGoalRange(input.goal, input.trainingContinuityConfirmed),
    completedVolume,
    completedMovementPatternCoverage,
    externalStrengthVolumeUnknown,
    bodyweightPullUnsupported,
    returning: input.returning,
    generatedAt: input.generatedAt,
    reasonCodes: [...new Set(reasonCodes)],
  }
}

export function initialStrengthWeekMaterializationState(
  blueprint?: StrengthWeekBlueprint,
): StrengthWeekMaterializationState {
  return {
    plannedVolume: {},
    movementPatternCoverage: [...(blueprint?.completedMovementPatternCoverage ?? [])],
    setProgressionVolume: {},
    materializedSessionCount: 0,
  }
}

export function maximumWeeklySetProgression(currentCalculatedSets: number) {
  if (!Number.isFinite(currentCalculatedSets) || currentCalculatedSets < 0) return 0
  if (currentCalculatedSets < 10) return 1
  return Math.min(2, Math.floor(currentCalculatedSets * 0.2))
}

function cloneWithSets(exercise: PrescribedSession['exercises'][number], sets: number) {
  return {
    ...exercise,
    sets,
    dose:
      exercise.dose?.kind === 'STRENGTH_SETS'
        ? { ...exercise.dose, sets }
        : exercise.dose,
  }
}

function successfulDistinctWeekWindows(
  exercise: PrescribedSession['exercises'][number],
  history: readonly AdultResistanceSetHistory[],
  generatedAt: string,
) {
  const upperRepetitions = Math.max(
    1,
    ...(exercise.repetitions?.match(/\d+/gu)?.map(Number) ?? [1]),
  )
  const generatedAtMs = Date.parse(generatedAt)
  const sessions = new Map<string, AdultResistanceSetHistory[]>()
  for (const row of history) {
    if (row.exerciseCode !== exercise.code || !row.sessionId) continue
    const rows = sessions.get(row.sessionId) ?? []
    rows.push(row)
    sessions.set(row.sessionId, rows)
  }
  return [...sessions.values()]
    .filter((rows) =>
      rows.every(
        (row) =>
          row.repetitions >= upperRepetitions &&
          row.completionStatus === 'COMPLETED' &&
          row.doseCompleted === true &&
          row.pain === false &&
          row.techniqueOk === true &&
          row.stopped !== true &&
          row.severeRecoveryProblem !== true &&
          row.difficultyTooHard !== true &&
          row.feltWorse !== true &&
          row.sessionRpeNineOrMore !== true &&
          row.severeDomsDeload !== true &&
          typeof row.rir === 'number' &&
          typeof row.targetRirMin === 'number' &&
          typeof row.targetRirMax === 'number' &&
          row.rir >= row.targetRirMin &&
          row.rir <= row.targetRirMax,
      ),
    )
    .map((rows) => {
      const ageDays = Math.floor(
        (generatedAtMs - Date.parse(rows[0]!.completedAt)) / 86_400_000,
      )
      if (ageDays < 0 || ageDays > 14) return null
      return ageDays <= 7 ? 0 : 1
    })
    .filter((window): window is 0 | 1 => window !== null)
}

export function materializeStrengthWeekSession(input: {
  prescription: PrescribedSession
  blueprint: StrengthWeekBlueprint
  state: StrengthWeekMaterializationState
  sequenceIndex: number
  history: readonly AdultResistanceSetHistory[]
  catalog?: ExerciseCatalog
}): {
  prescription: PrescribedSession
  context: StrengthWeekContext
  state: StrengthWeekMaterializationState
} {
  const catalog = input.catalog ?? publishedExerciseCatalog
  const combinedBefore = mergeMuscleVolume(
    input.blueprint.completedVolume,
    input.state.plannedVolume,
  )
  const rollingVolume = { ...combinedBefore }
  const sessionPrimaryVolume: MuscleVolume = {}
  let setProgressionUsed = false
  let setProgressionMuscles: readonly string[] = []
  const exercises = input.prescription.exercises.flatMap((source) => {
    const definition = catalog.getExercise(source.code)
    if (!definition) return []
    let sets = Math.min(
      source.sets,
      maximumAdditionalSets({
        exercise: definition,
        rollingVolume,
        sessionPrimaryVolume,
      }),
    )
    const successfulWindows = new Set(
      successfulDistinctWeekWindows(source, input.history, input.blueprint.generatedAt),
    )
    const progressionLimitAllows = definition.primaryMuscles.every((muscle) => {
      const current = combinedBefore[muscle] ?? 0
      const maximumIncrease = maximumWeeklySetProgression(current)
      return (input.state.setProgressionVolume[muscle] ?? 0) < maximumIncrease
    })
    const targetNeedsVolume = definition.primaryMuscles.some(
      (muscle) =>
        (combinedBefore[muscle] ?? 0) < input.blueprint.goalRange.minimumSetsPerMuscle,
    )
    const higherPriorityProgressionPending =
      source.progressionDecision?.reasonCodes.includes(
        'NEXT_AVAILABLE_LOAD_NOT_CONFIRMED',
      ) ||
      source.progressionDecision?.reasonCodes.includes(
        'VERIFIED_NEXT_LOAD_EXCEEDS_TEN_PERCENT',
      )
    const canConsiderSetProgression =
      !setProgressionUsed &&
      !input.blueprint.returning &&
      !input.blueprint.externalStrengthVolumeUnknown &&
      source.progressionDecision?.action === 'KEEP_LOAD' &&
      !higherPriorityProgressionPending &&
      successfulWindows.size === 2 &&
      progressionLimitAllows &&
      targetNeedsVolume
    if (canConsiderSetProgression) {
      const allowedWithProgression = maximumAdditionalSets({
        exercise: definition,
        rollingVolume,
        sessionPrimaryVolume,
      })
      if (allowedWithProgression >= sets + 1) {
        sets += 1
        setProgressionUsed = true
        setProgressionMuscles = definition.primaryMuscles
        source = {
          ...source,
          loadGuidance: `Seuraava askel: lisää yksi sarja (${sets} sarjaa) ja säilytä kuorma sekä toistoalue.`,
          progressionDecision: {
            ...source.progressionDecision!,
            action: 'INCREASE_SETS',
            nextSets: sets,
            changedVariable: 'SETS',
            reasonCodes: [
              ...source.progressionDecision!.reasonCodes,
              STRENGTH_WEEK_REASON_CODES.SET_PROGRESSION_ALLOWED,
            ],
          },
        }
      }
    }
    if (sets <= 0) return []
    const exercise = cloneWithSets(source, sets)
    addPlannedSets({
      exercise: definition,
      sets,
      rollingVolume,
      sessionPrimaryVolume,
    })
    return [exercise]
  })
  const candidate = {
    ...input.prescription,
    exercises,
    blocks: exercises,
    decisionTrace: {
      ...input.prescription.decisionTrace,
      ruleIds: [
        ...(input.prescription.decisionTrace.ruleIds ?? []),
        STRENGTH_WEEK_POLICY_VERSION,
        ...input.blueprint.reasonCodes,
      ],
    },
  }
  const fitted = fitStrengthPrescriptionToTimeBudget({
    prescription: candidate,
    timeBudgetMinutes: candidate.timeBudgetMinutes ?? candidate.durationMinutes,
  })
  if (fitted.status !== 'SUPPORTED') throw new Error(fitted.reasonCode)
  let fittedPrescription = fitted.prescription
  let volumeFilled = false
  if (input.sequenceIndex === input.blueprint.roles.length - 1) {
    const rollingAfter = { ...combinedBefore }
    const sessionPrimaryAfter: MuscleVolume = {}
    for (const exercise of fittedPrescription.exercises) {
      const definition = catalog.getExercise(exercise.code)
      if (!definition) continue
      addPlannedSets({
        exercise: definition,
        sets: exercise.sets,
        rollingVolume: rollingAfter,
        sessionPrimaryVolume: sessionPrimaryAfter,
      })
    }
    let changed = true
    while (changed) {
      changed = false
      for (let index = 0; index < fittedPrescription.exercises.length; index += 1) {
        const exercise = fittedPrescription.exercises[index]!
        const definition = catalog.getExercise(exercise.code)
        if (!definition) continue
        if (
          !definition.primaryMuscles.some(
            (muscle) =>
              (rollingAfter[muscle] ?? 0) < input.blueprint.goalRange.targetSetsPerMuscle,
          ) ||
          maximumAdditionalSets({
            exercise: definition,
            rollingVolume: rollingAfter,
            sessionPrimaryVolume: sessionPrimaryAfter,
          }) < 1
        ) {
          continue
        }
        const nextExercise = cloneWithSets(exercise, exercise.sets + 1)
        const nextExercises = fittedPrescription.exercises.map((candidate, position) =>
          position === index ? nextExercise : candidate,
        )
        const candidate = refreshStrengthPrescriptionTimeEstimate({
          ...fittedPrescription,
          exercises: nextExercises,
          blocks: nextExercises,
        })
        if (
          candidate.calculatedTotalSeconds! >
          (candidate.timeBudgetMinutes ?? candidate.durationMinutes) * 60
        ) {
          continue
        }
        fittedPrescription = candidate
        addPlannedSets({
          exercise: definition,
          sets: 1,
          rollingVolume: rollingAfter,
          sessionPrimaryVolume: sessionPrimaryAfter,
        })
        volumeFilled = true
        changed = true
      }
    }
  }
  const setProgressionPreserved = fittedPrescription.exercises.some(
    (exercise) => exercise.progressionDecision?.action === 'INCREASE_SETS',
  )
  const plannedThisSession = calculatePlannedMuscleVolume(fittedPrescription.exercises)
  const plannedVolumeAfter = mergeMuscleVolume(
    input.state.plannedVolume,
    plannedThisSession,
  )
  const combinedAfter = mergeMuscleVolume(
    input.blueprint.completedVolume,
    plannedVolumeAfter,
  )
  const coverage = [
    ...new Set([
      ...input.state.movementPatternCoverage,
      ...fittedPrescription.exercises.flatMap((exercise) => {
        const pattern = patternFromCategory(exercise.category)
        return pattern ? [pattern] : []
      }),
    ]),
  ] as StrengthMovementPattern[]
  const missingMovementPatterns = REQUIRED_PATTERNS.filter(
    (pattern) => !coverage.includes(pattern),
  )
  const reasonCodes = [
    ...input.blueprint.reasonCodes,
    STRENGTH_WEEK_REASON_CODES.PLANNED_VOLUME_COUNTED,
    STRENGTH_WEEK_REASON_CODES.ROLLING_CAP_ENFORCED,
    STRENGTH_WEEK_REASON_CODES.SESSION_CAP_ENFORCED,
    STRENGTH_WEEK_REASON_CODES.SAME_BLUEPRINT,
    STRENGTH_WEEK_REASON_CODES.WEEKLY_COVERAGE,
    STRENGTH_WEEK_REASON_CODES.MUSCLE_EXPOSURE_CAPPED,
    input.blueprint.roles[input.sequenceIndex] ?? 'FULL_BODY',
    ...(setProgressionPreserved
      ? [STRENGTH_WEEK_REASON_CODES.SET_PROGRESSION_ALLOWED]
      : [STRENGTH_WEEK_REASON_CODES.SET_PROGRESSION_WITHHELD]),
    ...(missingMovementPatterns.length
      ? [
          STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE,
          input.blueprint.bodyweightPullUnsupported
            ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_EQUIPMENT
            : STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME,
        ]
      : []),
    ...(volumeFilled ? [STRENGTH_WEEK_REASON_CODES.VOLUME_FILLED] : []),
  ]
  const context: StrengthWeekContext = {
    policyVersion: STRENGTH_WEEK_POLICY_VERSION,
    weekAnchorDate: input.blueprint.weekAnchorDate,
    role: input.blueprint.roles[input.sequenceIndex] ?? 'FULL_BODY',
    sequenceIndex: input.sequenceIndex,
    plannedExposureCount: input.blueprint.targetSessions,
    completedVolume: { ...input.blueprint.completedVolume },
    plannedVolumeBefore: { ...input.state.plannedVolume },
    plannedVolumeAfter,
    remainingTargetVolume: goalVolume(input.blueprint.goalRange, combinedAfter),
    hardCapRemaining: capRemaining(combinedAfter),
    movementPatternCoverage: coverage,
    missingMovementPatterns,
    reasonCodes: [...new Set(reasonCodes)],
  }
  return {
    prescription: {
      ...fittedPrescription,
      decisionTrace: { ...fittedPrescription.decisionTrace, strengthWeek: context },
    },
    context,
    state: {
      plannedVolume: plannedVolumeAfter,
      movementPatternCoverage: coverage,
      setProgressionVolume: setProgressionPreserved
        ? mergeMuscleVolume(
            input.state.setProgressionVolume,
            Object.fromEntries(setProgressionMuscles.map((muscle) => [muscle, 1])),
          )
        : { ...input.state.setProgressionVolume },
      materializedSessionCount: input.state.materializedSessionCount + 1,
    },
  }
}

export function finalizeStrengthWeekPlan(
  blueprint: StrengthWeekBlueprint,
  state: StrengthWeekMaterializationState,
  options: {
    unsupportedSessionReasons?: readonly string[]
    expectedMaterializedSessionCount?: number
    remainingTimeSeconds?: number
    minimumPolicyAdditionSeconds?: number
  } = {},
): StrengthWeekPlan {
  const combined = mergeMuscleVolume(blueprint.completedVolume, state.plannedVolume)
  const missingMovementPatterns = REQUIRED_PATTERNS.filter(
    (pattern) => !state.movementPatternCoverage.includes(pattern),
  )
  const unsupportedSessionReasons = options.unsupportedSessionReasons ?? []
  const expectedMaterializedSessionCount =
    options.expectedMaterializedSessionCount ?? blueprint.appSessionCount
  const hasUnsupportedChild = unsupportedSessionReasons.length > 0
  const missingMaterializedSession =
    state.materializedSessionCount < expectedMaterializedSessionCount
  const remainingTargetVolume = goalVolume(blueprint.goalRange, combined)
  const belowTarget = Object.values(remainingTargetVolume).some((amount) => amount > 0)
  const remainingTimeSeconds = Math.max(0, options.remainingTimeSeconds ?? 0)
  const minimumPolicyAdditionSeconds = Math.max(
    0,
    options.minimumPolicyAdditionSeconds ?? 0,
  )
  const timeActuallyLimitsNextAddition =
    minimumPolicyAdditionSeconds > 0 &&
    remainingTimeSeconds < minimumPolicyAdditionSeconds
  const status: StrengthWeekPlan['status'] = blueprint.bodyweightPullUnsupported
    ? 'UNSUPPORTED'
    : hasUnsupportedChild || missingMaterializedSession
      ? state.materializedSessionCount > 0
        ? 'PARTIAL'
        : 'UNSUPPORTED'
      : blueprint.targetSessions < 2 ||
          missingMovementPatterns.length > 0 ||
          blueprint.appSessionCount + blueprint.fixedStrengthExposureCount <
            blueprint.targetSessions
        ? 'PARTIAL'
        : 'SUPPORTED'
  const partialReasonCode =
    unsupportedSessionReasons[0] ??
    (blueprint.targetSessions < 2
      ? STRENGTH_WEEK_REASON_CODES.ONE_DAY_FULL_BODY
      : missingMovementPatterns.length > 0
        ? timeActuallyLimitsNextAddition
          ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME
          : STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE
        : belowTarget
          ? timeActuallyLimitsNextAddition
            ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME
            : STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_CONSTRAINT
          : STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE)
  return {
    policyVersion: STRENGTH_WEEK_POLICY_VERSION,
    weekAnchorDate: blueprint.weekAnchorDate,
    status,
    supportDecision:
      status === 'SUPPORTED'
        ? {
            reasonCode: STRENGTH_WEEK_REASON_CODES.FULLY_SUPPORTED,
            messageFi:
              'Viikon tavoiteharjoitukset ja vaaditut liikesuunnat on muodostettu.',
            actionFi: 'Noudata viikkosuunnitelmaa ja tee päivän kuntotarkistus.',
            evidence: {
              remainingTimeSeconds,
              minimumPolicyAdditionSeconds,
              unsupportedSessionCount: 0,
            },
          }
        : blueprint.bodyweightPullUnsupported
          ? {
              reasonCode: STRENGTH_WEEK_REASON_CODES.PULL_EQUIPMENT_REQUIRED,
              messageFi:
                'Tuettua koko viikon voimaharjoittelua ei voida muodostaa pelkällä kehonpainolla, koska turvallinen vetävä liikesuunta puuttuu.',
              actionFi:
                'Lisää välineisiin pitkä vastuskuminauha tai muu tuettu vetoväline.',
              evidence: {
                remainingTimeSeconds,
                minimumPolicyAdditionSeconds,
                unsupportedSessionCount: Math.max(1, unsupportedSessionReasons.length),
              },
            }
          : {
              reasonCode: partialReasonCode,
              messageFi:
                blueprint.targetSessions < 2
                  ? 'Käyttäjän valitsemaan yhteen harjoituspäivään ei mahdu koko viikon tavoitealtistusta.'
                  : partialReasonCode === STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME
                    ? 'Aikabudjetti ei riitä koko tavoitevolyymiin tai puuttuvaan liikesuuntaan turvallisia palautuksia ja puskuria säilyttäen.'
                    : partialReasonCode === STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE
                      ? 'Viikon pakollinen liikemallikattavuus jäi vajaaksi, vaikka aikaa olisi ollut versionoidun vähimmäislisäyksen verran.'
                      : partialReasonCode ===
                          STRENGTH_WEEK_REASON_CODES.EXTERNAL_VOLUME_UNKNOWN
                        ? 'Ulkopuolisen voimaharjoituksen sarjamäärä ei ole tiedossa, joten automaattista sarjaprogressiota ei tehdä.'
                        : 'Viikon vähimmäisvolyymi jäi vajaaksi turvallisen aika-, väline- tai volyymirajan vuoksi.',
              actionFi:
                blueprint.targetSessions < 2
                  ? 'Lisää toinen harjoituspäivä, jos se sopii arkeesi.'
                  : 'Tarkista päiväkohtainen aika ja välineet ennen viikon muuttamista.',
              evidence: {
                remainingTimeSeconds,
                minimumPolicyAdditionSeconds,
                unsupportedSessionCount: unsupportedSessionReasons.length,
              },
            },
    targetSessions: blueprint.targetSessions,
    appSessionCount: blueprint.appSessionCount,
    fixedStrengthExposureCount: blueprint.fixedStrengthExposureCount,
    sessionExposureCount:
      blueprint.completedStrengthExposureCount +
      blueprint.fixedStrengthExposureCount +
      state.materializedSessionCount,
    completedVolume: { ...blueprint.completedVolume },
    plannedVolume: { ...state.plannedVolume },
    remainingTargetVolume,
    hardCapRemaining: capRemaining(combined),
    movementPatternCoverage: [...state.movementPatternCoverage],
    missingMovementPatterns,
    reasonCodes: [
      ...new Set([
        ...blueprint.reasonCodes,
        ...blueprint.roles,
        STRENGTH_WEEK_REASON_CODES.WEEKLY_COVERAGE,
        STRENGTH_WEEK_REASON_CODES.MUSCLE_EXPOSURE_CAPPED,
        STRENGTH_WEEK_REASON_CODES.ROLLING_VOLUME_CAP,
        ...(status === 'SUPPORTED' ? [STRENGTH_WEEK_REASON_CODES.FULLY_SUPPORTED] : []),
        ...unsupportedSessionReasons,
        ...(belowTarget
          ? [
              blueprint.bodyweightPullUnsupported
                ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_EQUIPMENT
                : timeActuallyLimitsNextAddition
                  ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME
                  : STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_CONSTRAINT,
            ]
          : []),
        ...(missingMovementPatterns.length
          ? [STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE]
          : []),
      ]),
    ],
  }
}
