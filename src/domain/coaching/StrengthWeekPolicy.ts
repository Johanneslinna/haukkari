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
  StrengthExerciseProgrammingRole,
  StrengthMovementPattern,
  StrengthRoleStructureDecision,
  StrengthWeekContext,
  StrengthWeekPlan,
  StrengthWeekSessionRole,
} from './types'

export const STRENGTH_WEEK_POLICY_VERSION = 'adult-strength-week-1.5.0'

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
  ROLE_STRUCTURE_COMPLETE: 'STRENGTH_ROLE_STRUCTURE_COMPLETE',
  ROLE_STRUCTURE_TIME_LIMITED: 'STRENGTH_ROLE_STRUCTURE_TIME_LIMITED',
  ROLE_STRUCTURE_EQUIPMENT_LIMITED: 'STRENGTH_ROLE_STRUCTURE_EQUIPMENT_LIMITED',
  ROLE_STRUCTURE_HEALTH_LIMITED: 'STRENGTH_ROLE_STRUCTURE_HEALTH_LIMITED',
  ROLE_STRUCTURE_EXPERIENCE_LIMITED: 'STRENGTH_ROLE_STRUCTURE_EXPERIENCE_LIMITED',
  ROLE_STRUCTURE_VOLUME_LIMITED: 'STRENGTH_ROLE_STRUCTURE_VOLUME_LIMITED',
  ROLE_STRUCTURE_INVALID: 'STRENGTH_ROLE_STRUCTURE_UNDERFILLED_WITHOUT_CONSTRAINT',
  PREFERRED_VOLUME_BELOW_TARGET: 'WEEKLY_PREFERRED_VOLUME_BELOW_TARGET',
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
  roleStructures: StrengthRoleStructureDecision[]
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

export function strengthWeekRoleLabelFi(role: StrengthWeekSessionRole) {
  const labels: Record<StrengthWeekSessionRole, string> = {
    FULL_BODY: 'Kokovartalon voima',
    FULL_BODY_A: 'Kokovartalon voima A',
    FULL_BODY_B: 'Kokovartalon voima B',
    FULL_BODY_C: 'Kokovartalon voima C',
    UPPER_A: 'Ylävartalon voima A',
    LOWER_A: 'Alavartalon voima A',
    UPPER_B: 'Ylävartalon voima B',
    LOWER_B: 'Alavartalon voima B',
  }
  return labels[role]
}

export type StrengthWeekRoleSlot = {
  id: string
  movementPattern: string
  programmingRole: StrengthExerciseProgrammingRole
  required: boolean
  maximumSets?: number
}

export type StrengthWeekRoleStructure = {
  role: StrengthWeekSessionRole
  requiredMovementPatterns: string[]
  optionalMovementPatterns: string[]
  slots: StrengthWeekRoleSlot[]
  minimumExerciseCount: number
  targetExerciseCount: number
}

function slot(
  id: string,
  movementPattern: string,
  programmingRole: StrengthExerciseProgrammingRole,
  required = true,
  maximumSets?: number,
): StrengthWeekRoleSlot {
  return { id, movementPattern, programmingRole, required, maximumSets }
}

function longRoleSlots(role: StrengthWeekSessionRole): StrengthWeekRoleSlot[] {
  const slots: Record<StrengthWeekSessionRole, StrengthWeekRoleSlot[]> = {
    FULL_BODY: [
      slot('squat-primary', 'SQUAT', 'PRIMARY'),
      slot('pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
      slot('push-secondary', 'HORIZONTAL_PUSH', 'SECONDARY_COMPOUND'),
      slot('core-control', 'ANTI_EXTENSION', 'CORE_CONTROL', false),
      slot('hinge-secondary', 'HINGE', 'SECONDARY_COMPOUND', false),
    ],
    FULL_BODY_A: [
      slot('squat-primary', 'SQUAT', 'PRIMARY'),
      slot('pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
      slot('push-secondary', 'HORIZONTAL_PUSH', 'SECONDARY_COMPOUND'),
      slot('core-control', 'ANTI_EXTENSION', 'CORE_CONTROL', false),
      slot('hinge-secondary', 'HINGE', 'SECONDARY_COMPOUND', false),
    ],
    FULL_BODY_B: [
      slot('hinge-primary', 'HINGE', 'PRIMARY'),
      slot('push-primary', 'HORIZONTAL_PUSH', 'PRIMARY'),
      slot('pull-secondary', 'HORIZONTAL_PULL', 'SECONDARY_COMPOUND'),
      slot('core-control', 'ANTI_ROTATION', 'CORE_CONTROL', false),
      slot('squat-secondary', 'SQUAT', 'SECONDARY_COMPOUND', false),
    ],
    FULL_BODY_C: [
      slot('single-leg-primary', 'SINGLE_LEG', 'PRIMARY'),
      slot('pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
      slot('push-secondary', 'HORIZONTAL_PUSH', 'SECONDARY_COMPOUND'),
      slot('core-control', 'ANTI_ROTATION', 'CORE_CONTROL', false),
      slot('hinge-secondary', 'HINGE', 'SECONDARY_COMPOUND', false),
    ],
    UPPER_A: [
      slot('horizontal-push-primary', 'HORIZONTAL_PUSH', 'PRIMARY'),
      slot('horizontal-pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
      slot('vertical-pull-secondary', 'VERTICAL_PULL', 'SECONDARY_COMPOUND'),
      slot('vertical-push-secondary', 'VERTICAL_PUSH', 'SECONDARY_COMPOUND', true, 2),
      slot('core-control', 'ANTI_EXTENSION', 'CORE_CONTROL', false),
    ],
    LOWER_A: [
      slot('squat-primary', 'SQUAT', 'PRIMARY', true, 3),
      slot('hinge-secondary', 'HINGE', 'SECONDARY_COMPOUND', true, 2),
      slot('single-leg-accessory', 'SINGLE_LEG', 'ACCESSORY', false),
      slot('calf-accessory', 'CALF_RAISE', 'ACCESSORY', false),
    ],
    UPPER_B: [
      slot('vertical-pull-primary', 'VERTICAL_PULL', 'PRIMARY'),
      slot('vertical-push-secondary', 'VERTICAL_PUSH', 'SECONDARY_COMPOUND', true, 2),
      slot('horizontal-push-primary', 'HORIZONTAL_PUSH', 'PRIMARY'),
      slot('horizontal-pull-secondary', 'HORIZONTAL_PULL', 'SECONDARY_COMPOUND'),
      slot('core-control', 'ANTI_ROTATION', 'CORE_CONTROL', false),
    ],
    LOWER_B: [
      slot('hinge-primary', 'HINGE', 'PRIMARY', true, 3),
      slot('squat-primary', 'SQUAT', 'PRIMARY'),
      slot('single-leg-accessory', 'SINGLE_LEG', 'ACCESSORY', false),
      slot('calf-accessory', 'CALF_RAISE', 'ACCESSORY', false),
    ],
  }
  return slots[role]
}

function compactUpperSlots(role: 'UPPER_A' | 'UPPER_B', availableMinutes: number) {
  if (availableMinutes <= 20) {
    return role === 'UPPER_A'
      ? [
          slot('horizontal-push-primary', 'HORIZONTAL_PUSH', 'PRIMARY'),
          slot('horizontal-pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
          slot('core-control', 'ANTI_EXTENSION', 'CORE_CONTROL', false),
        ]
      : [
          slot('horizontal-pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
          slot('horizontal-push-primary', 'HORIZONTAL_PUSH', 'PRIMARY'),
          slot('core-control', 'ANTI_ROTATION', 'CORE_CONTROL', false),
        ]
  }
  if (availableMinutes <= 45) {
    return role === 'UPPER_A'
      ? [
          slot('horizontal-push-primary', 'HORIZONTAL_PUSH', 'PRIMARY'),
          slot('horizontal-pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
          slot('vertical-pull-secondary', 'VERTICAL_PULL', 'SECONDARY_COMPOUND'),
          slot('core-control', 'ANTI_EXTENSION', 'CORE_CONTROL', false),
        ]
      : [
          slot('horizontal-pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
          slot('horizontal-push-primary', 'HORIZONTAL_PUSH', 'PRIMARY'),
          slot('vertical-push-secondary', 'VERTICAL_PUSH', 'SECONDARY_COMPOUND'),
          slot('core-control', 'ANTI_ROTATION', 'CORE_CONTROL', false),
        ]
  }
  return longRoleSlots(role)
}

function roleSlotsForBudget(
  role: StrengthWeekSessionRole,
  availableMinutes: number,
): StrengthWeekRoleSlot[] {
  if (role === 'UPPER_A' || role === 'UPPER_B') {
    return compactUpperSlots(role, availableMinutes)
  }
  if (role === 'FULL_BODY_C' && availableMinutes <= 45) {
    return [
      slot('squat-primary', 'SQUAT', 'PRIMARY'),
      slot('pull-primary', 'HORIZONTAL_PULL', 'PRIMARY'),
      slot('push-secondary', 'HORIZONTAL_PUSH', 'SECONDARY_COMPOUND'),
      slot('core-control', 'ANTI_ROTATION', 'CORE_CONTROL', false),
      slot('hinge-secondary', 'HINGE', 'SECONDARY_COMPOUND', false),
    ]
  }
  return longRoleSlots(role)
}

export function strengthWeekRoleStructure(
  role: StrengthWeekSessionRole,
  availableMinutes: number,
  experience: ExperienceLevel = 'INTERMEDIATE',
): StrengthWeekRoleStructure {
  const sourceSlots = roleSlotsForBudget(role, availableMinutes)
  const budgetLimit =
    availableMinutes <= 10
      ? 2
      : availableMinutes <= 20
        ? 3
        : availableMinutes <= 45
          ? 4
          : 5
  const experienceLimit =
    experience === 'BEGINNER' && availableMinutes > 45 ? 4 : budgetLimit
  const targetExerciseCount = Math.min(sourceSlots.length, experienceLimit)
  const slots = sourceSlots.slice(0, targetExerciseCount)
  const minimumExerciseCount =
    role === 'UPPER_A' || role === 'UPPER_B'
      ? targetExerciseCount
      : role === 'LOWER_A' || role === 'LOWER_B'
        ? Math.min(targetExerciseCount, availableMinutes <= 20 ? 2 : 3)
        : Math.min(targetExerciseCount, availableMinutes <= 20 ? targetExerciseCount : 4)
  return {
    role,
    requiredMovementPatterns: [
      ...new Set(
        slots.filter((item) => item.required).map((item) => item.movementPattern),
      ),
    ],
    optionalMovementPatterns: [
      ...new Set(
        slots.filter((item) => !item.required).map((item) => item.movementPattern),
      ),
    ],
    slots,
    minimumExerciseCount,
    targetExerciseCount,
  }
}

export function evaluateStrengthRoleStructure(input: {
  structure: StrengthWeekRoleStructure
  exercises: readonly PrescribedSession['exercises'][number][]
  constraintReasonCodes?: readonly string[]
}): StrengthRoleStructureDecision {
  const filledRequiredSlotIds = input.structure.slots
    .filter(
      (item) =>
        item.required &&
        input.exercises.some((exercise) => exercise.programmingSlotId === item.id),
    )
    .map((item) => item.id)
  const requiredSlotIds = input.structure.slots
    .filter((item) => item.required)
    .map((item) => item.id)
  const complete =
    input.exercises.length >= input.structure.minimumExerciseCount &&
    filledRequiredSlotIds.length === requiredSlotIds.length
  const explicitConstraints = [...new Set(input.constraintReasonCodes ?? [])]
  const status: StrengthRoleStructureDecision['status'] = complete
    ? 'COMPLETE'
    : explicitConstraints.length > 0
      ? 'CONSTRAINED'
      : 'INVALID'
  const targetShortfall = input.exercises.length < input.structure.targetExerciseCount
  const reasonCodes = complete
    ? [
        STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_COMPLETE,
        ...(targetShortfall ? explicitConstraints : []),
      ]
    : explicitConstraints.length > 0
      ? explicitConstraints
      : [STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_INVALID]
  const primaryConstraint = reasonCodes[0]
  const messageFi = complete
    ? targetShortfall
      ? `${strengthWeekRoleLabelFi(input.structure.role)} täyttää roolin vähimmäisrakenteen (${input.exercises.length}/${input.structure.targetExerciseCount} liikettä); täydentävä sisältö rajautui turvallisen käyttäjärajoitteen vuoksi.`
      : `Täysi ${strengthWeekRoleLabelFi(input.structure.role).toLocaleLowerCase('fi-FI')} sisältää ${input.exercises.length} tavoitteen ja viikkoroolin mukaista liikettä.`
    : primaryConstraint === STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_TIME_LIMITED
      ? 'Harjoituksen rakennetta lyhennettiin käyttäjän valitseman enimmäisajan vuoksi.'
      : primaryConstraint === STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_EQUIPMENT_LIMITED
        ? 'Harjoituksen rakenne jäi tavallista suppeammaksi käytettävissä olevien välineiden vuoksi.'
        : primaryConstraint === STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_HEALTH_LIMITED
          ? 'Harjoituksen rakenne jäi tavallista suppeammaksi vahvistetun liikerajoitteen vuoksi.'
          : primaryConstraint ===
              STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_EXPERIENCE_LIMITED
            ? 'Harjoituksen rakenne sovitettiin harjoituskokemuksen mukaiseen turvalliseen tasoon.'
            : primaryConstraint ===
                STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_VOLUME_LIMITED
              ? 'Harjoituksen rakennetta rajattiin seitsemän vuorokauden lihasvolyymikaton vuoksi.'
              : 'Harjoituksen roolikohtainen vähimmäisrakenne jäi vajaaksi ilman tunnistettua käyttäjärajoitetta.'
  return {
    role: input.structure.role,
    status,
    minimumExerciseCount: input.structure.minimumExerciseCount,
    targetExerciseCount: input.structure.targetExerciseCount,
    actualExerciseCount: input.exercises.length,
    requiredSlotIds,
    filledRequiredSlotIds,
    reasonCodes,
    messageFi,
  }
}

export function refreshStrengthRoleStructureDecision(
  source: StrengthRoleStructureDecision | undefined,
  exercises: readonly PrescribedSession['exercises'][number][],
  additionalConstraintReasonCodes: readonly string[] = [],
) {
  if (!source) return undefined
  const syntheticStructure: StrengthWeekRoleStructure = {
    role: source.role,
    requiredMovementPatterns: [],
    optionalMovementPatterns: [],
    slots: source.requiredSlotIds.map((id) => slot(id, id, 'PRIMARY')),
    minimumExerciseCount: source.minimumExerciseCount,
    targetExerciseCount: source.targetExerciseCount,
  }
  return evaluateStrengthRoleStructure({
    structure: syntheticStructure,
    exercises,
    constraintReasonCodes: [
      ...source.reasonCodes.filter(
        (reasonCode) => reasonCode !== STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_COMPLETE,
      ),
      ...additionalConstraintReasonCodes,
    ],
  })
}

export function movementPatternsForRole(
  role: StrengthWeekSessionRole,
  availableMinutes: number,
): string[] {
  return strengthWeekRoleStructure(role, availableMinutes).slots.map(
    (item) => item.movementPattern,
  )
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

function remainingRoleExposuresForPattern(input: {
  roles: readonly StrengthWeekSessionRole[]
  sequenceIndex: number
  pattern: StrengthMovementPattern
  availableMinutes: number
}) {
  return input.roles
    .slice(input.sequenceIndex)
    .filter((role) =>
      movementPatternsForRole(role, input.availableMinutes).some(
        (category) => patternFromCategory(category) === input.pattern,
      ),
    ).length
}

function goalVolume(goalRange: StrengthWeekGoalRange, volume: Readonly<MuscleVolume>) {
  return volumeDeficit(goalRange.minimumSetsPerMuscle, volume)
}

function targetVolume(goalRange: StrengthWeekGoalRange, volume: Readonly<MuscleVolume>) {
  return volumeDeficit(goalRange.targetSetsPerMuscle, volume)
}

function volumeDeficit(targetSets: number, volume: Readonly<MuscleVolume>) {
  return Object.fromEntries(
    CANONICAL_MUSCLES.map((muscle) => [
      muscle,
      Math.max(0, targetSets - (volume[muscle] ?? 0)),
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
    roleStructures: [],
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

function programmingRoleSetCap(exercise: PrescribedSession['exercises'][number]) {
  if (exercise.programmingSetCap !== undefined) return exercise.programmingSetCap
  if (exercise.programmingRole === 'CORE_CONTROL') return 3
  if (exercise.programmingRole === 'ACCESSORY') return 3
  if (exercise.programmingRole === 'SECONDARY_COMPOUND') return 3
  return 6
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
  const finalSession = input.sequenceIndex === input.blueprint.roles.length - 1
  const progressionCandidate = (exercise: PrescribedSession['exercises'][number]) =>
    !input.blueprint.returning &&
    !input.blueprint.externalStrengthVolumeUnknown &&
    exercise.programmingRole !== 'CORE_CONTROL' &&
    exercise.progressionDecision?.action === 'KEEP_LOAD' &&
    new Set(
      successfulDistinctWeekWindows(exercise, input.history, input.blueprint.generatedAt),
    ).size === 2
  const sourceExercises = [...input.prescription.exercises].sort((left, right) => {
    const progressionPriority =
      Number(progressionCandidate(right)) - Number(progressionCandidate(left))
    if (progressionPriority !== 0) return progressionPriority
    if (
      !finalSession ||
      (input.prescription.timeBudgetMinutes ?? input.prescription.durationMinutes) <= 10
    ) {
      return 0
    }
    const deficitPriority = (exerciseCode: string) => {
      const definition = catalog.getExercise(exerciseCode)
      if (!definition) return { benefit: 0, urgency: 0 }
      const primaryDeficits = definition.primaryMuscles
        .filter((muscle) =>
          CANONICAL_MUSCLES.includes(muscle as (typeof CANONICAL_MUSCLES)[number]),
        )
        .map((muscle) =>
          Math.max(
            0,
            input.blueprint.goalRange.minimumSetsPerMuscle -
              (combinedBefore[muscle] ?? 0),
          ),
        )
      const secondaryDeficits = definition.secondaryMuscles
        .filter((muscle) =>
          CANONICAL_MUSCLES.includes(muscle as (typeof CANONICAL_MUSCLES)[number]),
        )
        .map((muscle) =>
          Math.max(
            0,
            input.blueprint.goalRange.minimumSetsPerMuscle -
              (combinedBefore[muscle] ?? 0),
          ),
        )
      return {
        benefit:
          primaryDeficits.reduce((total, deficit) => total + Math.min(1, deficit), 0) +
          secondaryDeficits.reduce((total, deficit) => total + Math.min(0.5, deficit), 0),
        urgency: Math.max(0, ...primaryDeficits, ...secondaryDeficits),
      }
    }
    const leftPriority = deficitPriority(left.code)
    const rightPriority = deficitPriority(right.code)
    return (
      rightPriority.benefit - leftPriority.benefit ||
      rightPriority.urgency - leftPriority.urgency
    )
  })
  const exercises = sourceExercises.flatMap((source) => {
    const definition = catalog.getExercise(source.code)
    if (!definition) return []
    const maximumSets = Math.min(
      maximumAdditionalSets({
        exercise: definition,
        rollingVolume,
        sessionPrimaryVolume,
        programmingRole: source.programmingRole,
      }),
      programmingRoleSetCap(source),
    )
    let sets = Math.min(source.sets, maximumSets)
    const pattern = patternFromCategory(source.category)
    if (
      pattern &&
      source.programmingRole !== 'CORE_CONTROL' &&
      (input.prescription.timeBudgetMinutes ?? input.prescription.durationMinutes) >= 45
    ) {
      const remainingExposures = Math.max(
        1,
        remainingRoleExposuresForPattern({
          roles: input.blueprint.roles,
          sequenceIndex: input.sequenceIndex,
          pattern,
          availableMinutes:
            input.prescription.timeBudgetMinutes ?? input.prescription.durationMinutes,
        }),
      )
      const minimumShare = Math.max(
        0,
        ...definition.primaryMuscles.map((muscle) =>
          Math.ceil(
            Math.max(
              0,
              input.blueprint.goalRange.minimumSetsPerMuscle -
                (rollingVolume[muscle] ?? 0),
            ) / remainingExposures,
          ),
        ),
      )
      sets = Math.min(maximumSets, Math.max(sets, minimumShare))
    }
    if (input.blueprint.targetSessions >= 4 && source.category === 'SINGLE_LEG') {
      sets = Math.min(sets, 1)
    }
    if (finalSession) {
      const primaryDeficit = Math.max(
        0,
        ...definition.primaryMuscles
          .filter((muscle) =>
            CANONICAL_MUSCLES.includes(muscle as (typeof CANONICAL_MUSCLES)[number]),
          )
          .map(
            (muscle) =>
              input.blueprint.goalRange.minimumSetsPerMuscle -
              (rollingVolume[muscle] ?? 0),
          ),
      )
      const secondaryDeficit = Math.max(
        0,
        ...definition.secondaryMuscles
          .filter((muscle) =>
            CANONICAL_MUSCLES.includes(muscle as (typeof CANONICAL_MUSCLES)[number]),
          )
          .map(
            (muscle) =>
              (input.blueprint.goalRange.minimumSetsPerMuscle -
                (rollingVolume[muscle] ?? 0)) /
              0.5,
          ),
      )
      const deficitDose = Math.ceil(primaryDeficit || secondaryDeficit)
      if (deficitDose > 0) sets = Math.min(sets, deficitDose)
    }
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
      source.programmingRole !== 'CORE_CONTROL' &&
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
        programmingRole: source.programmingRole,
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
      programmingRole: source.programmingRole,
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
        programmingRole: exercise.programmingRole,
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
          exercise.programmingRole === 'CORE_CONTROL' ||
          exercise.programmingRole === 'ACCESSORY' ||
          !definition.primaryMuscles.some(
            (muscle) =>
              (rollingAfter[muscle] ?? 0) < input.blueprint.goalRange.targetSetsPerMuscle,
          ) ||
          maximumAdditionalSets({
            exercise: definition,
            rollingVolume: rollingAfter,
            sessionPrimaryVolume: sessionPrimaryAfter,
            programmingRole: exercise.programmingRole,
          }) < 1
        ) {
          continue
        }
        if (exercise.sets >= programmingRoleSetCap(exercise)) continue
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
          programmingRole: exercise.programmingRole,
        })
        volumeFilled = true
        changed = true
      }
    }
  }
  const originalExerciseOrder = new Map(
    input.prescription.exercises.map((exercise, index) => [exercise.id, index]),
  )
  const orderedExercises = [...fittedPrescription.exercises].sort(
    (left, right) =>
      (originalExerciseOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (originalExerciseOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  )
  fittedPrescription = refreshStrengthPrescriptionTimeEstimate({
    ...fittedPrescription,
    exercises: orderedExercises,
    blocks: orderedExercises,
  })
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
  const roleStructureDecision = refreshStrengthRoleStructureDecision(
    input.prescription.strengthRoleStructure,
    fittedPrescription.exercises,
    fittedPrescription.exercises.length < input.prescription.exercises.length
      ? [STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_VOLUME_LIMITED]
      : [],
  )
  fittedPrescription = {
    ...fittedPrescription,
    strengthRoleStructure: roleStructureDecision,
  }
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
    ...(roleStructureDecision?.reasonCodes ?? []),
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
    remainingMinimumVolume: goalVolume(input.blueprint.goalRange, combinedAfter),
    remainingTargetVolume: targetVolume(input.blueprint.goalRange, combinedAfter),
    hardCapRemaining: capRemaining(combinedAfter),
    movementPatternCoverage: coverage,
    missingMovementPatterns,
    reasonCodes: [...new Set(reasonCodes)],
    roleStructure: roleStructureDecision,
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
      roleStructures: [
        ...input.state.roleStructures,
        ...(roleStructureDecision ? [roleStructureDecision] : []),
      ],
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
  const remainingMinimumVolume = goalVolume(blueprint.goalRange, combined)
  const remainingTargetVolume = targetVolume(blueprint.goalRange, combined)
  const belowMinimum = Object.values(remainingMinimumVolume).some((amount) => amount > 0)
  const belowTarget = Object.values(remainingTargetVolume).some((amount) => amount > 0)
  const structureStatus: NonNullable<StrengthWeekPlan['structureStatus']> =
    state.roleStructures.some((decision) => decision.status === 'INVALID')
      ? 'INVALID'
      : state.roleStructures.some((decision) => decision.status === 'CONSTRAINED')
        ? 'CONSTRAINED'
        : 'SUPPORTED'
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
          belowMinimum ||
          structureStatus !== 'SUPPORTED' ||
          missingMovementPatterns.length > 0 ||
          blueprint.appSessionCount + blueprint.fixedStrengthExposureCount <
            blueprint.targetSessions
        ? 'PARTIAL'
        : 'SUPPORTED'
  const partialReasonCode =
    unsupportedSessionReasons[0] ??
    (structureStatus === 'INVALID'
      ? STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_INVALID
      : structureStatus === 'CONSTRAINED'
        ? (state.roleStructures.find((decision) => decision.status === 'CONSTRAINED')
            ?.reasonCodes[0] ?? STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_INVALID)
        : blueprint.targetSessions < 2
          ? STRENGTH_WEEK_REASON_CODES.ONE_DAY_FULL_BODY
          : missingMovementPatterns.length > 0
            ? timeActuallyLimitsNextAddition
              ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME
              : STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE
            : belowMinimum
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
            messageFi: belowTarget
              ? 'Viikon harjoitusrakenne ja vähimmäisvolyymi on muodostettu. Tavoitevolyymia ei täytetty keinotekoisella lisätyöllä.'
              : 'Viikon tavoiteharjoitukset, rakenteet ja vaaditut liikesuunnat on muodostettu.',
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
                partialReasonCode === STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_INVALID
                  ? 'Yhden tai useamman harjoituksen roolikohtainen vähimmäisrakenne jäi vajaaksi ilman tunnistettua käyttäjärajoitetta.'
                  : (state.roleStructures.find((decision) =>
                      decision.reasonCodes.includes(partialReasonCode),
                    )?.messageFi ??
                    (blueprint.targetSessions < 2
                      ? 'Käyttäjän valitsemaan yhteen harjoituspäivään ei mahdu koko viikon tavoitealtistusta.'
                      : partialReasonCode === STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME
                        ? 'Aikabudjetti ei riitä koko tavoitevolyymiin tai puuttuvaan liikesuuntaan turvallisia palautuksia ja puskuria säilyttäen.'
                        : partialReasonCode ===
                            STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE
                          ? 'Viikon pakollinen liikemallikattavuus jäi vajaaksi, vaikka aikaa olisi ollut versionoidun vähimmäislisäyksen verran.'
                          : partialReasonCode ===
                              STRENGTH_WEEK_REASON_CODES.EXTERNAL_VOLUME_UNKNOWN
                            ? 'Ulkopuolisen voimaharjoituksen sarjamäärä ei ole tiedossa, joten automaattista sarjaprogressiota ei tehdä.'
                            : 'Viikon vähimmäisvolyymi jäi vajaaksi turvallisen aika-, väline- tai volyymirajan vuoksi.')),
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
    minimumSetsPerMuscle: blueprint.goalRange.minimumSetsPerMuscle,
    targetSetsPerMuscle: blueprint.goalRange.targetSetsPerMuscle,
    completedVolume: { ...blueprint.completedVolume },
    plannedVolume: { ...state.plannedVolume },
    remainingMinimumVolume,
    remainingTargetVolume,
    hardCapRemaining: capRemaining(combined),
    movementPatternCoverage: [...state.movementPatternCoverage],
    missingMovementPatterns,
    structureStatus,
    roleStructures: [...state.roleStructures],
    minimumVolumeStatus: belowMinimum ? 'BELOW_MINIMUM' : 'MET',
    targetVolumeStatus: belowTarget ? 'BELOW_TARGET' : 'MET',
    reasonCodes: [
      ...new Set([
        ...blueprint.reasonCodes,
        ...blueprint.roles,
        STRENGTH_WEEK_REASON_CODES.WEEKLY_COVERAGE,
        STRENGTH_WEEK_REASON_CODES.MUSCLE_EXPOSURE_CAPPED,
        STRENGTH_WEEK_REASON_CODES.ROLLING_VOLUME_CAP,
        ...(status === 'SUPPORTED' ? [STRENGTH_WEEK_REASON_CODES.FULLY_SUPPORTED] : []),
        ...unsupportedSessionReasons,
        ...state.roleStructures.flatMap((decision) => decision.reasonCodes),
        ...(belowMinimum
          ? [
              blueprint.bodyweightPullUnsupported
                ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_EQUIPMENT
                : timeActuallyLimitsNextAddition
                  ? STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_TIME
                  : STRENGTH_WEEK_REASON_CODES.BELOW_TARGET_CONSTRAINT,
            ]
          : []),
        ...(belowTarget
          ? [STRENGTH_WEEK_REASON_CODES.PREFERRED_VOLUME_BELOW_TARGET]
          : []),
        ...(missingMovementPatterns.length
          ? [STRENGTH_WEEK_REASON_CODES.COVERAGE_INCOMPLETE]
          : []),
      ]),
    ],
  }
}
