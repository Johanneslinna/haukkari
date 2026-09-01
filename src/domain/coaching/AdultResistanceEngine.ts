import {
  publishedExerciseCatalog,
  type ExerciseCatalog,
  type ExerciseDefinition,
} from './content/TrainingContent'
import { withV2Blocks } from './PrescriptionContract'
import {
  ADULT_STRENGTH_TIME_POLICY,
  ADULT_STRENGTH_TIME_POLICY_VERSION,
  fitStrengthPrescriptionToTimeBudget,
} from './TimeBudgetPolicy'
import type {
  CapabilityEstimate,
  ExerciseProgressionDecision,
  ExerciseLoadType,
  ExercisePrescription,
  ExperienceLevel,
  GoalType,
  PrescribedSession,
  SetPainResponse,
  SessionObjective,
  WorkoutCompletionStatus,
  VerifiedNextLoad,
  StrengthExerciseProgrammingRole,
  StrengthWeekSessionRole,
} from './types'
import { evaluateStrengthSafetyGate } from './StrengthSafetyGate'
import {
  STRENGTH_VOLUME_POLICY_VERSION,
  addPlannedSets,
  calculateRollingMuscleVolume,
  maximumAdditionalSets,
  type MuscleVolume,
} from './StrengthVolumePolicy'
import {
  findVerifiedNextLoad,
  isAutomaticLoadIncreaseAllowed,
  isKilogramLoadType,
} from './VerifiedNextLoad'
import {
  evaluateStrengthReturn,
  reduceReturnWorkingSets,
  STRENGTH_RETURN_POLICY_VERSION,
  type StrengthReturnDecision,
  type StrengthTrainingBackground,
} from './ReturnToStrengthPolicy'
import {
  evaluateStrengthRoleStructure,
  STRENGTH_WEEK_REASON_CODES,
  strengthWeekRoleStructure,
  type StrengthWeekRoleSlot,
} from './StrengthWeekPolicy'
import {
  SEVERE_DOMS_STRENGTH_PROGRESSION_REASON_CODE,
  SEVERE_DOMS_STRENGTH_REASON_CODE,
} from './ReadinessEngine'

export const ADULT_RESISTANCE_ENGINE_VERSION = 'adult-resistance-1.6.0'
export const ADULT_RESISTANCE_RULE_VERSION = 'adult-resistance-rules-1.6.0'

const strengthWeekTrackedMuscles = new Set([
  'quadriceps',
  'gluteals',
  'hamstrings',
  'chest',
  'triceps',
  'latissimus',
  'upper back',
  'trunk',
])
export const ADULT_RESISTANCE_LOAD_CONTEXT_VERSION = 'adult-resistance-load-context-1.0.0'

const experienceRank: Record<ExperienceLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
}

export type AdultResistanceSetHistory = {
  /** Tallennetun WorkoutRecordin tunniste; saman harjoituksen kaikilla sarjoilla sama. */
  sessionId?: string
  exerciseCode: string
  exerciseVersion?: string
  movementPatterns?: readonly string[]
  primaryMuscles?: readonly string[]
  secondaryMuscles?: readonly string[]
  loadKg: number | null
  loadType?: ExerciseLoadType
  /** Versionoitu väline-/kuormakonteksti, jossa kilogrammat ovat vertailukelpoisia. */
  loadContextId?: string
  /** Käyttäjän välineille vahvistettu todellinen pienin kuormaporras. */
  loadIncrementKg?: number
  repetitions: number
  rir?: number | null
  completedAt: string
  pain?: boolean
  techniqueOk?: boolean
  completionStatus?: WorkoutCompletionStatus
  doseCompleted?: boolean
  /** Tallennetun prescriptionin RIR-alue paluuharjoituksen hyväksyntää varten. */
  targetRirMin?: number
  targetRirMax?: number
  stopped?: boolean
  severeRecoveryProblem?: boolean
  difficultyTooHard?: boolean
  feltWorse?: boolean
  sessionRpeNineOrMore?: boolean
  /**
   * Harjoitus tehtiin voimakkaan DOMS:n vuoksi kevennetyllä annoksella.
   * Tällainen toteuma lasketaan tehdyksi volyymiksi, mutta se ei valtuuta
   * capability-arviota, kalibrointia tai progressiota.
   */
  severeDomsDeload?: boolean
}

export type AdultResistanceAthleteContext = {
  age: number
  contentReleaseId: string
  ruleVersion: string
  experience: ExperienceLevel
  goal: GoalType
  equipment: string[]
  environment: 'HOME' | 'GYM'
  availableMinutes: number
  generatedAt: string
  physicalLoad: 'LOW' | 'MODERATE' | 'HIGH'
  readiness: 'GREEN' | 'YELLOW' | 'ORANGE_RECOVERY' | 'RED_STOP'
  healthBlocked?: boolean
  limitationTags: string[]
  dislikedExerciseCodes: string[]
  likedExerciseCodes: string[]
  supervisionAvailable: boolean
  /** Käyttäjän nimenomaisesti vahvistamat kuormakohtaiset seuraavat vaihtoehdot. */
  verifiedNextLoads?: readonly VerifiedNextLoad[]
  strengthTrainingBackground?: StrengthTrainingBackground
  /** Viikkopolitiikan määräämä harjoitusrakenne; ei päätellä kellosta tai listan indeksistä. */
  strengthWeekRole?: StrengthWeekSessionRole
}

export type EligibilityDecision = {
  exercise: ExerciseDefinition
  eligible: boolean
  reasonCodes: string[]
}

export type ExerciseCandidateScore = {
  exercise: ExerciseDefinition
  score: number
  scoreComponents: Record<string, number>
}

export type ResistanceDoseDecision = {
  sets: number
  repetitions: number | [number, number]
  prescribedLoadKg?: number
  prescribedLoadRangeKg?: [number, number]
  targetRir: number | [number, number]
  restSeconds: number
  tempo?: string
  calibrationRequired: boolean
  confidence: 'LOW' | 'MODERATE' | 'HIGH'
  ruleIds: string[]
  evidenceClaimIds: string[]
}

export type SetAdaptationAction =
  | 'MAINTAIN'
  | 'INCREASE_ONE_INCREMENT'
  | 'DECREASE_ONE_INCREMENT'
  | 'INCREASE_REPETITIONS'
  | 'REDUCE_REPETITIONS'
  | 'REMOVE_REMAINING_SET'
  | 'STOP_EXERCISE'
  | 'REFER_SAFETY'

export type SetAdaptationDecision = {
  action: SetAdaptationAction
  adjustedLoadKg?: number
  adjustedRepetitions?: number
  reasonCodes: string[]
}

export const MAX_AUTOMATIC_LOAD_INCREASE_RATIO = 0.1

export function nextAutomaticLoadKg(
  currentLoadKg: number,
  availableIncrementKg: number,
): number | null {
  if (
    !Number.isFinite(currentLoadKg) ||
    !Number.isFinite(availableIncrementKg) ||
    currentLoadKg <= 0 ||
    availableIncrementKg <= 0 ||
    availableIncrementKg / currentLoadKg > MAX_AUTOMATIC_LOAD_INCREASE_RATIO
  ) {
    return null
  }
  return currentLoadKg + availableIncrementKg
}

export type InterSessionProgressionDecision = {
  action: 'RECALIBRATE_LOAD' | 'KEEP_LOAD' | 'INCREASE_LOAD' | 'INCREASE_REPETITIONS'
  currentLoadKg?: number
  nextLoadKg?: number
  nextRepetitions?: number
  changedVariable: 'NONE' | 'LOAD' | 'REPETITIONS'
  reasonCodes: string[]
  supportingSessionIds: string[]
}

function goalAdaptation(goal: GoalType) {
  if (goal === 'MAX_STRENGTH') return 'MAX_STRENGTH'
  if (goal === 'MUSCLE_GAIN' || goal === 'BODY_RECOMPOSITION') return 'HYPERTROPHY'
  return 'GENERAL_STRENGTH'
}

export function createResistanceSessionObjective(
  context: AdultResistanceAthleteContext,
): SessionObjective {
  const primaryAdaptation = goalAdaptation(context.goal)
  const roleStructure = context.strengthWeekRole
    ? strengthWeekRoleStructure(
        context.strengthWeekRole,
        context.availableMinutes,
        context.experience,
      )
    : undefined
  const requiredMovementPatterns = roleStructure?.requiredMovementPatterns ?? [
    'SQUAT',
    'HINGE',
    'HORIZONTAL_PUSH',
    'HORIZONTAL_PULL',
    'ANTI_EXTENSION',
  ]
  const lowBudget = context.physicalLoad === 'HIGH' || context.readiness === 'YELLOW'
  return {
    primary: primaryAdaptation === 'HYPERTROPHY' ? 'Lihasmassa' : 'Kokovartalon voima',
    secondary: ['Liikehallinta'],
    fatigueBudget: lowBudget ? 'LOW' : 'MODERATE',
    avoid: context.limitationTags.length ? ['Oiretta provosoivat liikkeet'] : [],
    primaryAdaptation,
    secondaryAdaptations: ['GENERAL_STRENGTH', 'FUNCTION'],
    sessionKind: 'STRENGTH',
    durationMinutes: context.availableMinutes,
    intensityIntent:
      context.experience === 'BEGINNER' ? 'CONSERVATIVE_TECHNIQUE' : 'SUBMAXIMAL',
    fatigueLimits: {
      systemic: lowBudget ? 3 : 4,
      lowerBody: lowBudget ? 3 : 4,
      upperBody: lowBudget ? 3 : 4,
      eccentric: lowBudget ? 3 : 4,
    },
    requiredMovementPatterns,
    optionalMovementPatterns: roleStructure?.optionalMovementPatterns ?? [
      'VERTICAL_PUSH',
      'VERTICAL_PULL',
      'SINGLE_LEG',
      'ANTI_ROTATION',
    ],
    avoidTags: context.limitationTags,
    evidenceClaimIds: [
      'CLAIM-ADULT-RT-BASE-001',
      'CLAIM-ADULT-RT-EFFORT-001',
      'CLAIM-ADULT-RT-LOAD-001',
    ],
  }
}

function equipmentAvailable(exercise: ExerciseDefinition, available: string[]) {
  if (exercise.equipment.length === 0) return true
  return exercise.equipment.some((item) => available.includes(item))
}

export function filterEligibleExercises(
  catalog: ExerciseCatalog,
  athleteContext: AdultResistanceAthleteContext,
  sessionObjective: SessionObjective,
): EligibilityDecision[] {
  const maximumComplexity =
    athleteContext.experience === 'BEGINNER'
      ? 2
      : athleteContext.experience === 'INTERMEDIATE'
        ? 4
        : 5
  return catalog.listExercises().map((exercise) => {
    const reasonCodes: string[] = []
    if (exercise.status !== 'PUBLISHED') reasonCodes.push('EXERCISE_NOT_PUBLISHED')
    if (exercise.method !== 'RESISTANCE') reasonCodes.push('METHOD_MISMATCH')
    if (!exercise.environments.includes(athleteContext.environment))
      reasonCodes.push('ENVIRONMENT_MISMATCH')
    if (!equipmentAvailable(exercise, athleteContext.equipment))
      reasonCodes.push('EQUIPMENT_UNAVAILABLE')
    if (exercise.minimumAge && athleteContext.age < exercise.minimumAge)
      reasonCodes.push('MINIMUM_AGE_NOT_MET')
    if (exercise.maximumAge && athleteContext.age > exercise.maximumAge)
      reasonCodes.push('MAXIMUM_AGE_EXCEEDED')
    if (
      experienceRank[athleteContext.experience] <
      experienceRank[exercise.minimumExperience]
    )
      reasonCodes.push('EXPERIENCE_NOT_MET')
    if (exercise.technicalComplexity > maximumComplexity)
      reasonCodes.push('TECHNICAL_COMPLEXITY_TOO_HIGH')
    if (
      exercise.supervisionRequirement === 'REQUIRED' &&
      !athleteContext.supervisionAvailable
    )
      reasonCodes.push('SUPERVISION_REQUIRED')
    if (
      exercise.contraindicationTags.some((tag) =>
        athleteContext.limitationTags.includes(tag),
      )
    )
      reasonCodes.push('CONTRAINDICATION_MATCH')
    if (athleteContext.dislikedExerciseCodes.includes(exercise.code))
      reasonCodes.push('EXPLICIT_DISLIKE')
    const fatigueLimits = sessionObjective.fatigueLimits
    if (
      fatigueLimits &&
      (exercise.fatigue.systemic > fatigueLimits.systemic ||
        exercise.fatigue.eccentric > fatigueLimits.eccentric)
    )
      reasonCodes.push('FATIGUE_BUDGET_EXCEEDED')
    const adaptationFit = exercise.adaptationTargets.includes(
      sessionObjective.primaryAdaptation ?? '',
    )
    const movementFit = exercise.movementPatterns.some(
      (pattern) =>
        sessionObjective.requiredMovementPatterns?.includes(pattern) ||
        sessionObjective.optionalMovementPatterns?.includes(pattern),
    )
    if (!adaptationFit && !movementFit) reasonCodes.push('OBJECTIVE_MISMATCH')
    return { exercise, eligible: reasonCodes.length === 0, reasonCodes }
  })
}

export function scoreExerciseCandidates(
  eligibleExercises: readonly ExerciseDefinition[],
  athleteContext: AdultResistanceAthleteContext,
  sessionObjective: SessionObjective,
  history: readonly AdultResistanceSetHistory[],
): ExerciseCandidateScore[] {
  return eligibleExercises
    .map((exercise) => {
      const recentSuccesses = new Set(
        history
          .filter(
            (item) =>
              item.exerciseCode === exercise.code &&
              item.sessionId &&
              item.pain === false &&
              item.techniqueOk === true,
          )
          .map((item) => item.sessionId!),
      ).size
      const scoreComponents = {
        adaptationFit: exercise.adaptationTargets.includes(
          sessionObjective.primaryAdaptation ?? '',
        )
          ? 20
          : 8,
        movementPatternFit: exercise.movementPatterns.some(
          (pattern) =>
            sessionObjective.requiredMovementPatterns?.includes(pattern) ||
            sessionObjective.optionalMovementPatterns?.includes(pattern),
        )
          ? 16
          : 6,
        goalFit: exercise.adaptationTargets.includes(goalAdaptation(athleteContext.goal))
          ? 12
          : 4,
        experienceFit: Math.max(
          0,
          8 -
            Math.abs(
              experienceRank[athleteContext.experience] -
                experienceRank[exercise.minimumExperience],
            ) *
              2,
        ),
        equipmentFit: equipmentAvailable(exercise, athleteContext.equipment) ? 8 : 0,
        preferenceFit: athleteContext.likedExerciseCodes.includes(exercise.code) ? 8 : 2,
        historicalResponseFit: Math.min(8, recentSuccesses * 2),
        adherenceProbability: exercise.technicalComplexity <= 2 ? 6 : 4,
        variationValue: recentSuccesses === 0 ? 3 : 1,
        weeklySecondaryOverlapCost: athleteContext.strengthWeekRole
          ? -exercise.secondaryMuscles.filter((muscle) =>
              strengthWeekTrackedMuscles.has(muscle),
            ).length * 4
          : 0,
        fatigueCost: -exercise.fatigue.systemic * 2,
        sorenessCost: -exercise.fatigue.sorenessRisk,
        riskCost: -exercise.technicalComplexity,
        scheduleInterference:
          athleteContext.physicalLoad === 'HIGH' ? -exercise.fatigue.eccentric * 2 : 0,
      }
      return {
        exercise,
        score: Object.values(scoreComponents).reduce((total, value) => total + value, 0),
        scoreComponents,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.exercise.code.localeCompare(right.exercise.code, 'en'),
    )
}

function roundToIncrement(value: number, increment: number) {
  return Math.round(value / increment) * increment
}

export function defaultResistanceLoadContextId(
  exercise: ExerciseDefinition,
): string | undefined {
  const loadType = (exercise.loadTypes[0] ?? 'NONE') as ExerciseLoadType
  if (loadType === 'EXTERNAL_KG') {
    return `${ADULT_RESISTANCE_LOAD_CONTEXT_VERSION}:external-kg`
  }
  if (loadType === 'DUMBBELL_KG_EACH') {
    return `${ADULT_RESISTANCE_LOAD_CONTEXT_VERSION}:dumbbell-kg-each`
  }
  // Laitteen kilomäärä on vertailukelpoinen vasta, kun juuri käytetty laite on
  // tunnistettu. Kehonpaino- ja nauhaliikkeille kilogrammakontekstia ei luoda.
  return undefined
}

function historyAgeDays(completedAt: string, generatedAtMs: number) {
  return (generatedAtMs - Date.parse(completedAt)) / 86_400_000
}

function groupBySession(
  history: readonly AdultResistanceSetHistory[],
): Map<string, AdultResistanceSetHistory[]> {
  const sessions = new Map<string, AdultResistanceSetHistory[]>()
  for (const item of history) {
    if (!item.sessionId) continue
    const existing = sessions.get(item.sessionId) ?? []
    existing.push(item)
    sessions.set(item.sessionId, existing)
  }
  return sessions
}

export function estimateAdultResistanceCapability(
  exercise: ExerciseDefinition,
  history: readonly AdultResistanceSetHistory[],
  generatedAt: string,
  experience: ExperienceLevel,
): CapabilityEstimate {
  const now = Date.parse(generatedAt)
  const primaryMovementPattern = exercise.movementPatterns[0]
  const loadType = (exercise.loadTypes[0] ?? 'NONE') as ExerciseLoadType
  const supportsComparableKilograms = isKilogramLoadType(loadType)
  if (!supportsComparableKilograms) {
    return {
      exerciseCode: exercise.code,
      confidence: 'LOW',
      supportingSetCount: 0,
      supportingSessionCount: 0,
      supportingSessionIds: [],
      calibrationRequired: true,
      reasons: ['LOAD_TYPE_NOT_COMPARABLE_IN_KILOGRAMS', 'PRECISE_LOAD_WITHHELD'],
    }
  }
  const requiredLoadContextId = defaultResistanceLoadContextId(exercise)
  if (!requiredLoadContextId) {
    return {
      exerciseCode: exercise.code,
      confidence: 'LOW',
      supportingSetCount: 0,
      supportingSessionCount: 0,
      supportingSessionIds: [],
      calibrationRequired: true,
      reasons: [
        'COMPARABLE_LOAD_CONTEXT_REQUIRED',
        'MACHINE_LOAD_NOT_COMPARABLE_ACROSS_DEVICES',
        'PRECISE_LOAD_WITHHELD',
      ],
    }
  }
  const exerciseSets = history.filter((item) => {
    const ageDays = historyAgeDays(item.completedAt, now)
    return (
      item.exerciseCode === exercise.code &&
      item.exerciseVersion === exercise.version &&
      Boolean(item.sessionId) &&
      item.loadType === loadType &&
      item.loadContextId === requiredLoadContextId &&
      item.completionStatus === 'COMPLETED' &&
      item.doseCompleted === true &&
      item.severeDomsDeload !== true &&
      item.loadKg &&
      item.loadKg > 0 &&
      item.repetitions > 0 &&
      item.repetitions <= 15 &&
      ageDays >= 0 &&
      ageDays <= 180
    )
  })
  const sessions = new Map(
    [...groupBySession(exerciseSets).entries()].filter(([, sets]) =>
      sets.every(
        (item) =>
          item.pain === false &&
          item.techniqueOk === true &&
          item.rir !== null &&
          item.rir !== undefined,
      ),
    ),
  )
  const valid = [...sessions.values()].flat()
  const supportingSessionIds = [...sessions.keys()].sort()
  const supportingSessionCount = supportingSessionIds.length
  if (supportingSessionCount < 2) {
    const movementFamilySupport = history.filter((item) => {
      const ageDays = historyAgeDays(item.completedAt, now)
      return (
        item.exerciseCode !== exercise.code &&
        item.severeDomsDeload !== true &&
        primaryMovementPattern !== undefined &&
        item.movementPatterns?.includes(primaryMovementPattern) &&
        item.repetitions > 0 &&
        item.rir !== null &&
        item.rir !== undefined &&
        ageDays >= 0 &&
        ageDays <= 180 &&
        !item.pain &&
        item.techniqueOk !== false
      )
    }).length
    return {
      exerciseCode: exercise.code,
      confidence: 'LOW',
      supportingSetCount: valid.length + movementFamilySupport,
      supportingSessionCount,
      supportingSessionIds,
      latestValidSetAt: exerciseSets
        .map((item) => item.completedAt)
        .sort()
        .at(-1),
      calibrationRequired: true,
      reasons: [
        ...(history.some(
          (item) =>
            item.exerciseCode === exercise.code &&
            (!item.sessionId || !item.exerciseVersion || !item.loadContextId),
        )
          ? ['LEGACY_HISTORY_IDENTITY_OR_CONTEXT_INCOMPLETE']
          : []),
        'COMPARABLE_EXERCISE_SESSIONS_BELOW_TWO',
        ...(movementFamilySupport > 0
          ? ['MOVEMENT_FAMILY_HISTORY_USED_AS_CONTEXT_ONLY']
          : []),
        'PRECISE_LOAD_WITHHELD',
      ],
    }
  }
  const latestValidSetAt = valid
    .map((item) => item.completedAt)
    .sort()
    .at(-1)!
  const latestAgeDays = historyAgeDays(latestValidSetAt, now)
  if (latestAgeDays > 90) {
    return {
      exerciseCode: exercise.code,
      confidence: 'LOW',
      supportingSetCount: valid.length,
      supportingSessionCount,
      supportingSessionIds,
      latestValidSetAt,
      calibrationRequired: true,
      reasons: ['COMPARABLE_HISTORY_OLDER_THAN_NINETY_DAYS', 'PRECISE_LOAD_WITHHELD'],
    }
  }
  const estimates = [...sessions.values()].map((sets) => {
    const setEstimates = sets.map(
      (item) => item.loadKg! * (1 + (item.repetitions + (item.rir ?? 0)) / 30),
    )
    return setEstimates.reduce((total, value) => total + value, 0) / setEstimates.length
  })
  const estimated1RmKg = roundToIncrement(
    estimates.reduce((total, value) => total + value, 0) / estimates.length,
    0.5,
  )
  // Tämä on arvion esitystarkkuus, ei käyttäjän todellinen kuormaporras.
  const increment = exercise.loadTypes.includes('DUMBBELL_KG_EACH') ? 1 : 2.5
  const range: [number, number] = [
    roundToIncrement(estimated1RmKg * 0.65, increment),
    roundToIncrement(estimated1RmKg * 0.8, increment),
  ]
  return {
    exerciseCode: exercise.code,
    estimated1RmKg,
    workingLoadRangeKg: range,
    confidence:
      supportingSessionCount >= 4 &&
      experience !== 'BEGINNER' &&
      latestAgeDays <= 45 &&
      !exercise.loadTypes.includes('MACHINE_KG')
        ? 'HIGH'
        : 'MODERATE',
    supportingSetCount: valid.length,
    supportingSessionCount,
    supportingSessionIds,
    latestValidSetAt,
    calibrationRequired: false,
    reasons: [
      'RECENT_COMPARABLE_LOAD_REPS_RIR_USED',
      'ESTIMATE_NOT_MEASURED_MAXIMUM',
      'DISTINCT_WORKOUT_RECORDS_USED',
      `LOAD_CONTEXT:${requiredLoadContextId}`,
    ],
  }
}

export function prescribeResistanceDose(
  objective: SessionObjective,
  exercise: ExerciseDefinition,
  capability: CapabilityEstimate,
  athleteContext: AdultResistanceAthleteContext,
  weeklyVolumeState: { comparableSetsThisWeek: number },
): ResistanceDoseDecision {
  const strengthGoal = athleteContext.goal === 'MAX_STRENGTH'
  const hypertrophyGoal =
    athleteContext.goal === 'MUSCLE_GAIN' || athleteContext.goal === 'BODY_RECOMPOSITION'
  let sets = athleteContext.experience === 'BEGINNER' ? 2 : 3
  if (athleteContext.experience === 'ADVANCED' && athleteContext.availableMinutes >= 60)
    sets = 4
  if (
    (objective.fatigueBudget === 'LOW' ||
      weeklyVolumeState.comparableSetsThisWeek >= 12) &&
    sets > 2
  )
    sets = Math.max(1, sets - 1)
  const repetitions: [number, number] = hypertrophyGoal
    ? [8, 12]
    : strengthGoal
      ? capability.calibrationRequired || athleteContext.experience === 'BEGINNER'
        ? [6, 10]
        : athleteContext.experience === 'INTERMEDIATE'
          ? [5, 8]
          : [4, 6]
      : [8, 12]
  const targetRir: [number, number] =
    athleteContext.experience === 'BEGINNER'
      ? [3, 4]
      : objective.fatigueBudget === 'LOW'
        ? [3, 4]
        : [2, 3]
  const restSeconds = strengthGoal
    ? 150
    : exercise.movementPatterns.some((pattern) => ['SQUAT', 'HINGE'].includes(pattern))
      ? 120
      : 90
  return {
    sets,
    repetitions,
    prescribedLoadRangeKg: capability.calibrationRequired
      ? undefined
      : capability.workingLoadRangeKg,
    targetRir,
    restSeconds,
    tempo:
      athleteContext.experience === 'BEGINNER' ? 'Hallittu alas, vakaa ylös' : undefined,
    calibrationRequired: capability.calibrationRequired,
    confidence: capability.confidence,
    ruleIds: [
      'RT-BASE-DOSE-001',
      'RT-RIR-001',
      ...(capability.calibrationRequired ? ['RT-CALIBRATION-001'] : []),
    ],
    evidenceClaimIds: [
      'CLAIM-ADULT-RT-BASE-001',
      'CLAIM-ADULT-RT-EFFORT-001',
      'CLAIM-ADULT-RT-LOAD-001',
    ],
  }
}

function doseForProgrammingRole(
  source: ResistanceDoseDecision,
  programmingRole: StrengthExerciseProgrammingRole | undefined,
  athleteContext: AdultResistanceAthleteContext,
): ResistanceDoseDecision {
  if (!programmingRole || programmingRole === 'PRIMARY') return source
  if (programmingRole === 'SECONDARY_COMPOUND') {
    return {
      ...source,
      sets: Math.min(3, source.sets),
      restSeconds: Math.max(90, source.restSeconds),
      ruleIds: [...source.ruleIds, 'RT-SECONDARY-COMPOUND-DOSE-001'],
    }
  }
  if (programmingRole === 'ACCESSORY') {
    return {
      ...source,
      sets: Math.min(athleteContext.experience === 'BEGINNER' ? 2 : 3, source.sets),
      targetRir: [3, 4],
      restSeconds: 60,
      ruleIds: [...source.ruleIds, 'RT-ACCESSORY-DOSE-001'],
    }
  }
  return {
    ...source,
    sets:
      athleteContext.experience === 'BEGINNER' || athleteContext.availableMinutes <= 45
        ? 2
        : 3,
    repetitions: [6, 10],
    targetRir: [3, 4],
    restSeconds: 60,
    calibrationRequired: false,
    prescribedLoadKg: undefined,
    prescribedLoadRangeKg: undefined,
    ruleIds: [
      ...source.ruleIds.filter((ruleId) => ruleId !== 'RT-CALIBRATION-001'),
      'RT-CORE-CONTROL-DOSE-001',
    ],
  }
}

function loadTracking(exercise: ExerciseDefinition): {
  loadType: ExerciseLoadType
  loadLabelFi: string
  loadOptions?: string[]
  loadContextId?: string
} {
  const available = exercise.loadTypes[0] ?? 'NONE'
  if (available === 'BAND')
    return {
      loadType: 'BAND',
      loadLabelFi: 'Nauhan vastus',
      loadOptions: ['Erittäin kevyt', 'Kevyt', 'Keskivahva', 'Vahva', 'Erittäin vahva'],
    }
  if (available === 'BODYWEIGHT')
    return { loadType: 'BODYWEIGHT', loadLabelFi: 'Variaatio tai lisäpaino' }
  if (available === 'DUMBBELL_KG_EACH')
    return {
      loadType: 'DUMBBELL_KG_EACH',
      loadLabelFi: 'Kuorma kg / käsipaino',
      loadContextId: defaultResistanceLoadContextId(exercise),
    }
  if (available === 'MACHINE_KG')
    return { loadType: 'MACHINE_KG', loadLabelFi: 'Laitteen kuorma kg' }
  return {
    loadType: 'EXTERNAL_KG',
    loadLabelFi: 'Kuorma kg',
    loadContextId: defaultResistanceLoadContextId(exercise),
  }
}

function selectedPatternOrder(minutes: number) {
  if (minutes <= 20) return ['SQUAT', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL']
  if (minutes <= 30) return ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL']
  return ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL', 'ANTI_EXTENSION']
}

function progressionGuidanceFi(decision: InterSessionProgressionDecision) {
  switch (decision.action) {
    case 'INCREASE_REPETITIONS':
      return `Seuraava askel: lisää yksi toisto (${decision.nextRepetitions}) ja säilytä sama kuorma.`
    case 'INCREASE_LOAD':
      return `Seuraava askel: nosta kuorma vahvistettuun seuraavaan portaaseen (${decision.nextLoadKg} kg).`
    case 'KEEP_LOAD':
      if (decision.reasonCodes.includes('NEXT_AVAILABLE_LOAD_NOT_CONFIRMED')) {
        return 'Seuraava askel: säilytä kuorma ja vahvista pienin seuraava käytettävissä oleva kuorma.'
      }
      if (decision.reasonCodes.includes('VERIFIED_NEXT_LOAD_EXCEEDS_TEN_PERCENT')) {
        return 'Seuraava askel: säilytä kuorma. Vahvistettu kuormaporras ylittää 10 %, joten automaattista nostoa ei tehdä.'
      }
      return 'Seuraava askel: säilytä nykyinen kuorma.'
    case 'RECALIBRATE_LOAD':
      return 'Seuraava askel: kalibroi kuorma uudelleen ennen tarkkaa kuormasuositusta.'
  }
}

function severeDomsProgressionDecision(
  exercise: ExercisePrescription,
): ExerciseProgressionDecision {
  return {
    action: 'KEEP_LOAD',
    ...(exercise.progressionDecision?.currentLoadKg === undefined
      ? {}
      : {
          currentLoadKg: exercise.progressionDecision.currentLoadKg,
          nextLoadKg: exercise.progressionDecision.currentLoadKg,
        }),
    changedVariable: 'NONE',
    reasonCodes: [
      ...new Set([
        ...(exercise.progressionDecision?.reasonCodes ?? []),
        SEVERE_DOMS_STRENGTH_REASON_CODE,
        SEVERE_DOMS_STRENGTH_PROGRESSION_REASON_CODE,
      ]),
    ],
    supportingSessionIds: exercise.progressionDecision?.supportingSessionIds ?? [],
  }
}

export function freezeSevereDomsProgression(exercise: ExercisePrescription) {
  const decision = severeDomsProgressionDecision(exercise)
  const baseGuidance = exercise.loadGuidance.replace(/\s*Seuraava askel:.*$/u, '')
  return {
    ...exercise,
    loadGuidance:
      exercise.programmingRole === 'CORE_CONTROL'
        ? `${baseGuidance} Seuraava askel: säilytä helppo, täysin hallittu variaatio; kevennetty harjoitus ei valtuuta vaikeuttamaan liikettä.`
        : `${baseGuidance} Seuraava askel: säilytä kuorma ja toistot; voimakkaan lihasarkuuden kevennetty harjoitus ei valtuuta progressiota.`,
    progressionDecision: decision,
  }
}

export function refreshAdultResistanceProgression(input: {
  prescription: PrescribedSession
  history: readonly AdultResistanceSetHistory[]
  verifiedNextLoads?: readonly VerifiedNextLoad[]
  generatedAt: string
}): PrescribedSession {
  if (input.prescription.kind !== 'STRENGTH') return input.prescription
  if (
    input.prescription.decisionTrace.rules.some(
      (rule) => rule.ruleId === 'READINESS-SEVERE-DOMS-001',
    )
  ) {
    const exercises = input.prescription.exercises.map(freezeSevereDomsProgression)
    return { ...input.prescription, exercises, blocks: exercises }
  }
  const adaptations: NonNullable<PrescribedSession['decisionTrace']['adaptations']> = []
  const exercises = input.prescription.exercises.map((exercise) => {
    if (exercise.programmingRole === 'CORE_CONTROL') return exercise
    const maximumRepetitions = Math.max(
      1,
      ...(exercise.repetitions?.match(/\d+/gu)?.map(Number) ?? [1]),
    )
    const targetRirValue = exercise.targetRir ?? Math.max(0, 10 - exercise.targetRpe)
    const targetRir: [number, number] = exercise.targetRirRange ?? [
      targetRirValue,
      Math.min(5, targetRirValue + 1),
    ]
    const decision = decideInterSessionProgression({
      comparableSessions: input.history,
      targetRir,
      verifiedNextLoads: input.verifiedNextLoads,
      targetExerciseCode: exercise.code,
      targetExerciseVersion: exercise.contentVersion,
      targetLoadType: exercise.loadType,
      targetLoadContextId: exercise.loadContextId,
      maximumRepetitions,
      generatedAt: input.generatedAt,
    })
    adaptations.push({
      original: {
        exerciseCode: exercise.code,
        action: exercise.progressionDecision?.action ?? null,
      },
      adjusted: {
        action: decision.action,
        nextLoadKg: decision.nextLoadKg ?? null,
        nextRepetitions: decision.nextRepetitions ?? null,
      },
      reasonCodes: decision.reasonCodes,
    })
    const baseGuidance = exercise.loadGuidance.replace(/\s*Seuraava askel:.*$/u, '')
    return {
      ...exercise,
      loadGuidance: `${baseGuidance} ${progressionGuidanceFi(decision)}`,
      progressionDecision: decision as ExerciseProgressionDecision,
    }
  })
  return {
    ...input.prescription,
    exercises,
    blocks: exercises,
    decisionTrace: {
      ...input.prescription.decisionTrace,
      adaptations: [
        ...(input.prescription.decisionTrace.adaptations ?? []),
        ...adaptations,
      ],
    },
  }
}

function latestHistoricalLoad(
  exercise: ExercisePrescription,
  history: readonly AdultResistanceSetHistory[],
  before?: string | null,
) {
  const value = [...history]
    .filter(
      (row) =>
        row.exerciseCode === exercise.code &&
        row.exerciseVersion === exercise.contentVersion &&
        row.loadType === exercise.loadType &&
        (!exercise.loadContextId || row.loadContextId === exercise.loadContextId) &&
        typeof row.loadKg === 'number' &&
        row.loadKg > 0 &&
        (!before || Date.parse(row.completedAt) < Date.parse(before)),
    )
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
    .at(-1)?.loadKg
  return typeof value === 'number' ? value : undefined
}

function postBreakCalibrationSessions(
  exercise: ExercisePrescription,
  history: readonly AdultResistanceSetHistory[],
  cutoff: string | null,
) {
  if (!cutoff) return []
  return [
    ...new Set(
      history
        .filter(
          (row) =>
            row.sessionId &&
            row.exerciseCode === exercise.code &&
            row.exerciseVersion === exercise.contentVersion &&
            row.loadType === exercise.loadType &&
            (!exercise.loadContextId || row.loadContextId === exercise.loadContextId) &&
            Date.parse(row.completedAt) >= Date.parse(cutoff) &&
            isApprovedCalibrationRow(row),
        )
        .map((row) => row.sessionId!),
    ),
  ]
}

function isApprovedCalibrationRow(row: AdultResistanceSetHistory) {
  return (
    row.completionStatus === 'COMPLETED' &&
    row.doseCompleted === true &&
    row.pain === false &&
    row.techniqueOk === true &&
    row.stopped !== true &&
    row.severeRecoveryProblem !== true &&
    row.severeDomsDeload !== true &&
    typeof row.rir === 'number' &&
    typeof row.targetRirMin === 'number' &&
    typeof row.targetRirMax === 'number' &&
    row.rir >= row.targetRirMin &&
    row.rir <= row.targetRirMax
  )
}

function suppressReturnProgression(
  exercise: ExercisePrescription,
  decision: StrengthReturnDecision,
  history: readonly AdultResistanceSetHistory[],
) {
  if (!decision.progressionSuppressed) return exercise
  const historicalLoadKg = latestHistoricalLoad(
    exercise,
    history,
    decision.historyAuthorityCutoffAt,
  )
  const postBreakSessionIds = postBreakCalibrationSessions(
    exercise,
    history,
    decision.historyAuthorityCutoffAt,
  )
  const postBreakCalibrated =
    decision.state === 'RETURNING_56_PLUS_DAYS' && postBreakSessionIds.length >= 2
  const postBreakLoadKg = postBreakCalibrated
    ? latestHistoricalLoad(exercise, history)
    : undefined
  const recalibrate = decision.previousLoadDisplayOnly && !postBreakCalibrated
  const reasonCodes = [...new Set(decision.reasonCodes)]
  const historicalReference =
    historicalLoadKg === undefined
      ? ''
      : ` Aiempi kuorma – ei tämän harjoituksen automaattinen suositus: ${historicalLoadKg} kg.`
  const progressionDecision: ExerciseProgressionDecision = {
    action: recalibrate ? 'RECALIBRATE_LOAD' : 'KEEP_LOAD',
    ...(historicalLoadKg === undefined ? {} : { currentLoadKg: historicalLoadKg }),
    changedVariable: 'NONE',
    reasonCodes,
    supportingSessionIds: postBreakSessionIds,
  }
  return {
    ...exercise,
    loadGuidance: postBreakCalibrated
      ? `Kahden paluun jälkeisen harjoituksen kuorma-arvio on käytettävissä${
          postBreakLoadKg === undefined ? '' : ` (${postBreakLoadKg} kg)`
        }. Säilytä kuorma, kunnes koko paluujakso on valmis.`
      : recalibrate
        ? `${historicalReference} Kalibroi tämän päivän kuorma tavoite-RIR:n perusteella; moottori ei keksi kilogrammaporrasta.`.trim()
        : `Tauolta paluun aikana kuorma ja toistot pidetään ennallaan. ${exercise.loadGuidance}`,
    progressionDecision,
  }
}

function conservativeRepetitions(repetitions: string | undefined) {
  if (!repetitions) return '6–10'
  const values = repetitions.match(/\d+/gu)?.map(Number) ?? []
  if (values.length === 0 || Math.min(...values) < 6) return '6–10'
  return repetitions
}

function applyReturnDose(
  source: readonly ExercisePrescription[],
  decision: StrengthReturnDecision,
  history: readonly AdultResistanceSetHistory[],
) {
  let exercises = source.map((exercise) => ({ ...exercise }))
  if (decision.state === 'BREAK_8_TO_14_DAYS') {
    exercises = reduceReturnWorkingSets(exercises, 0.75)
  } else if (decision.state === 'BREAK_15_TO_27_DAYS') {
    exercises = reduceReturnWorkingSets(exercises, 0.65).map((exercise) => {
      const targetRir = Math.min(4, (exercise.targetRir ?? 3) + 1)
      return {
        ...exercise,
        targetRir,
        targetRirRange: [targetRir, Math.min(4, targetRir + 1)] as [number, number],
        targetRpe: Math.max(5, 10 - targetRir),
        dose:
          exercise.dose?.kind === 'STRENGTH_SETS'
            ? {
                ...exercise.dose,
                targetRir,
                targetRpe: Math.max(5, 10 - targetRir),
              }
            : exercise.dose,
      }
    })
  } else if (
    decision.state === 'RETURN_BLOCK_28_TO_55_DAYS' ||
    decision.state === 'RETURNING_56_PLUS_DAYS'
  ) {
    exercises = exercises.map((exercise) => {
      const sets = Math.max(1, Math.min(2, exercise.sets))
      const repetitions = conservativeRepetitions(exercise.repetitions)
      return {
        ...exercise,
        sets,
        repetitions,
        targetRir: 3,
        targetRirRange: [3, 4] as [number, number],
        targetRpe: 7,
        dose:
          exercise.dose?.kind === 'STRENGTH_SETS'
            ? {
                ...exercise.dose,
                sets,
                repetitions,
                targetRir: 3,
                targetRpe: 7,
              }
            : exercise.dose,
      }
    })
  }
  return exercises.map((exercise) =>
    suppressReturnProgression(exercise, decision, history),
  )
}

export function prescribeAdultResistanceSession(input: {
  sessionId: string
  title: string
  context: AdultResistanceAthleteContext
  history?: readonly AdultResistanceSetHistory[]
  catalog?: ExerciseCatalog
}): PrescribedSession {
  const safetyGate = evaluateStrengthSafetyGate({
    sessionKind: 'STRENGTH',
    age: input.context.age,
    readiness: input.context.readiness,
    healthBlocked: input.context.healthBlocked,
  })
  if (!safetyGate.allowed) {
    throw new Error(`UNSUPPORTED_PRESCRIPTION:${safetyGate.reasonCode}`)
  }
  const catalog = input.catalog ?? publishedExerciseCatalog
  if (catalog.getReleaseId() !== input.context.contentReleaseId) {
    throw new Error(
      `CONTENT_RELEASE_MISMATCH:${input.context.contentReleaseId}:${catalog.getReleaseId()}`,
    )
  }
  const history = (input.history ?? []).map((item) => ({
    ...item,
    movementPatterns:
      item.movementPatterns ?? catalog.getExercise(item.exerciseCode)?.movementPatterns,
    // Legacy-rivin puuttuvaa versiota ei saa jälkikäteen nimetä nykyversioksi.
    exerciseVersion: item.exerciseVersion,
    primaryMuscles:
      item.primaryMuscles ?? catalog.getExercise(item.exerciseCode)?.primaryMuscles,
    secondaryMuscles:
      item.secondaryMuscles ?? catalog.getExercise(item.exerciseCode)?.secondaryMuscles,
  }))
  const returnDecision = evaluateStrengthReturn({
    history,
    generatedAt: input.context.generatedAt,
    background: input.context.strengthTrainingBackground,
  })
  const authoritativeHistory = returnDecision.historyAuthorityCutoffAt
    ? history.filter(
        (item) =>
          Date.parse(item.completedAt) >=
          Date.parse(returnDecision.historyAuthorityCutoffAt!),
      )
    : history
  const postLongBreakAuthorityRestricted =
    returnDecision.historyAuthorityCutoffAt !== null &&
    returnDecision.breakDays !== null &&
    returnDecision.breakDays >= 56
  const capabilityAndProgressionHistory = postLongBreakAuthorityRestricted
    ? authoritativeHistory.filter(isApprovedCalibrationRow)
    : authoritativeHistory
  const objective = createResistanceSessionObjective(input.context)
  const eligibility = filterEligibleExercises(catalog, input.context, objective)
  const eligible = eligibility
    .filter((item) => item.eligible)
    .map((item) => item.exercise)
  const scores = scoreExerciseCandidates(eligible, input.context, objective, history)
  const chosen: ExerciseCandidateScore[] = []
  const chosenSlots: Array<StrengthWeekRoleSlot | undefined> = []
  const roleStructure = input.context.strengthWeekRole
    ? strengthWeekRoleStructure(
        input.context.strengthWeekRole,
        input.context.availableMinutes,
        input.context.experience,
      )
    : undefined
  const requiredPatternOrder = selectedPatternOrder(input.context.availableMinutes)
  if (roleStructure) {
    for (const roleSlot of roleStructure.slots) {
      const primaryMatches = scores.filter(
        (item) =>
          item.exercise.movementPatterns[0] === roleSlot.movementPattern &&
          !chosen.includes(item),
      )
      const secondaryMatches = scores.filter(
        (item) =>
          item.exercise.movementPatterns.includes(roleSlot.movementPattern) &&
          !chosen.includes(item),
      )
      const candidates = primaryMatches.length > 0 ? primaryMatches : secondaryMatches
      const preferVariation =
        (roleStructure.role === 'UPPER_B' || roleStructure.role === 'FULL_BODY_B') &&
        roleSlot.movementPattern !== 'SQUAT' &&
        candidates.length > 1 &&
        candidates[1]!.score >= candidates[0]!.score - 12
      const complementarySquat =
        roleStructure.role === 'FULL_BODY_C' && roleSlot.movementPattern === 'SQUAT'
          ? candidates.find((item) =>
              item.exercise.secondaryMuscles.includes('hamstrings'),
            )
          : undefined
      const candidate = complementarySquat ?? candidates[preferVariation ? 1 : 0]
      if (!candidate) continue
      chosen.push(candidate)
      chosenSlots.push(roleSlot)
    }
  } else {
    for (const pattern of requiredPatternOrder) {
      const candidate =
        scores.find(
          (item) =>
            item.exercise.movementPatterns[0] === pattern && !chosen.includes(item),
        ) ??
        scores.find(
          (item) =>
            item.exercise.movementPatterns.includes(pattern) && !chosen.includes(item),
        )
      if (candidate) {
        chosen.push(candidate)
        chosenSlots.push(undefined)
      }
    }
  }
  const maximumCandidateCount = roleStructure
    ? roleStructure.targetExerciseCount
    : input.context.availableMinutes <= 10
      ? 2
      : input.context.availableMinutes <= 20
        ? 3
        : input.context.availableMinutes <= 30
          ? 5
          : input.context.availableMinutes <= 45
            ? 7
            : input.context.availableMinutes <= 60
              ? 8
              : 10
  // Ensin katetaan roolin liikesuunnat. Vasta sen jälkeen jäljellä oleva
  // turvallinen aika voidaan käyttää saman roolin volyymia täydentäviin liikkeisiin.
  for (const candidate of scores) {
    if (chosen.length >= maximumCandidateCount) break
    if (chosen.includes(candidate)) continue
    if (roleStructure) continue
    chosen.push(candidate)
    chosenSlots.push(undefined)
  }
  const capabilities = chosen.map((item) =>
    estimateAdultResistanceCapability(
      item.exercise,
      capabilityAndProgressionHistory,
      input.context.generatedAt,
      input.context.experience,
    ),
  )
  const generatedAtMs = Date.parse(input.context.generatedAt)
  const doses = chosen.map((item, index) => {
    const comparableSetsThisWeek = authoritativeHistory.filter((set) => {
      const ageDays = (generatedAtMs - Date.parse(set.completedAt)) / 86_400_000
      return (
        ageDays >= 0 &&
        ageDays <= 7 &&
        !set.pain &&
        set.techniqueOk !== false &&
        (set.exerciseCode === item.exercise.code ||
          set.movementPatterns?.some((pattern) =>
            item.exercise.movementPatterns.includes(pattern),
          ))
      )
    }).length
    const roleDose = doseForProgrammingRole(
      prescribeResistanceDose(
        objective,
        item.exercise,
        capabilities[index]!,
        input.context,
        { comparableSetsThisWeek },
      ),
      chosenSlots[index]?.programmingRole,
      input.context,
    )
    const programmingSetCap = chosenSlots[index]?.maximumSets
    return programmingSetCap === undefined
      ? roleDose
      : { ...roleDose, sets: Math.min(roleDose.sets, programmingSetCap) }
  })
  const rollingVolume = calculateRollingMuscleVolume({
    sets: history,
    at: input.context.generatedAt,
    catalog,
  })
  const sessionPrimaryVolume: MuscleVolume = {}
  chosen.forEach((item, index) => {
    const dose = doses[index]!
    dose.sets = Math.min(
      dose.sets,
      maximumAdditionalSets({
        exercise: item.exercise,
        rollingVolume,
        sessionPrimaryVolume,
        programmingRole: chosenSlots[index]?.programmingRole,
      }),
    )
    if (dose.sets > 0) {
      addPlannedSets({
        exercise: item.exercise,
        sets: dose.sets,
        rollingVolume,
        sessionPrimaryVolume,
        programmingRole: chosenSlots[index]?.programmingRole,
      })
    } else {
      dose.ruleIds.push('RT-WEEKLY-MUSCLE-CAP-001')
    }
  })
  const warmupMinutes =
    ADULT_STRENGTH_TIME_POLICY.warmupSecondsForBudget(input.context.availableMinutes) / 60
  const cooldownMinutes =
    ADULT_STRENGTH_TIME_POLICY.cooldownSecondsForBudget(input.context.availableMinutes) /
    60
  const baseExercises: ExercisePrescription[] = chosen.flatMap((item, index) => {
    const dose = doses[index]!
    if (dose.sets <= 0) return []
    const programmingSlot = chosenSlots[index]
    const programmingRole = programmingSlot?.programmingRole
    const coreControl = programmingRole === 'CORE_CONTROL'
    const repetitions = coreControl
      ? item.exercise.code === 'FRONT_PLANK'
        ? '20–40 s'
        : '6–10 / puoli'
      : Array.isArray(dose.repetitions)
        ? `${dose.repetitions[0]}–${dose.repetitions[1]}`
        : String(dose.repetitions)
    const targetRir = Array.isArray(dose.targetRir) ? dose.targetRir[0] : dose.targetRir
    const load = loadTracking(item.exercise)
    const maximumRepetitions = Array.isArray(dose.repetitions)
      ? dose.repetitions[1]
      : dose.repetitions
    const progressionDecision: InterSessionProgressionDecision = coreControl
      ? {
          action: 'KEEP_LOAD',
          changedVariable: 'NONE',
          reasonCodes: ['CORE_CONTROL_QUALITY_PROGRESSION'],
          supportingSessionIds: [],
        }
      : decideInterSessionProgression({
          comparableSessions: capabilityAndProgressionHistory,
          targetRir: Array.isArray(dose.targetRir)
            ? dose.targetRir
            : [dose.targetRir, dose.targetRir],
          verifiedNextLoads: input.context.verifiedNextLoads,
          targetExerciseCode: item.exercise.code,
          targetExerciseVersion: item.exercise.version,
          targetLoadType: load.loadType,
          targetLoadContextId: load.loadContextId,
          maximumRepetitions,
          generatedAt: input.context.generatedAt,
        })
    const bodyweightGuidance =
      'Valitse variaatio, jossa liikerata ja asento säilyvät hallittuina. Etene ensin toistoissa, kestossa tai liikeradassa ja muuta vain yhtä vaikeustekijää kerrallaan.'
    const coreGuidance =
      'Pidä hengitys, selän ja lantion asento sekä liikkeen hallinta muuttumattomina. Etene vasta kaikkien laadukkaiden toistojen jälkeen pidentämällä vipuvartta, liikerataa tai kestoa yksi muutos kerrallaan.'
    const loadGuidance = coreControl
      ? coreGuidance
      : load.loadType === 'BODYWEIGHT'
        ? bodyweightGuidance
        : `${
            dose.calibrationRequired
              ? 'Aloita kevyellä kalibroivalla sarjalla. Valitse kuorma, jolla tavoitetoistot onnistuvat hallitusti ja toistoja jää tavoitealueen verran varastoon.'
              : `Suositeltu työkuorma on arviolta ${dose.prescribedLoadRangeKg?.[0]}–${dose.prescribedLoadRangeKg?.[1]} kg. Arvio ei ole mitattu maksimi.`
          } ${progressionGuidanceFi(progressionDecision)}`
    const substitutions = item.exercise.substitutionCodes
      .map((code) => catalog.getExercise(code)?.nameFi)
      .filter((name): name is string => Boolean(name))
    return [
      {
        id: `${input.sessionId}-${item.exercise.code.toLocaleLowerCase('en-US')}`,
        code: item.exercise.code,
        contentVersion: item.exercise.version,
        nameFi: item.exercise.nameFi,
        category: item.exercise.movementPatterns[0] ?? 'Voima',
        equipment: [...item.exercise.equipment],
        instructionsFi: item.exercise.instructionsFi.join(' '),
        sets: dose.sets,
        repetitions,
        restSeconds: dose.restSeconds,
        targetRpe: Math.max(5, 10 - targetRir),
        targetRir,
        warmupSets: index === 0 && dose.calibrationRequired ? 1 : 0,
        estimatedWorkSetSeconds: coreControl
          ? 45
          : programmingRole === 'ACCESSORY'
            ? 50
            : ADULT_STRENGTH_TIME_POLICY.workSetSeconds,
        loadGuidance,
        stopCondition: coreControl
          ? 'Lopeta sarja, kun hengitys tai selän ja lantion asento ei enää säily hallittuna, tai jos liike provosoi kipua.'
          : 'Keskeytä, jos liike provosoi kipua tai tekniikka ei pysy hallittuna.',
        substitutions,
        ...load,
        progressionDecision: progressionDecision as ExerciseProgressionDecision,
        difficulty: item.exercise.minimumExperience,
        trainingEffects: [...item.exercise.adaptationTargets],
        fatigueCost:
          item.exercise.fatigue.systemic <= 2
            ? 'LOW'
            : item.exercise.fatigue.systemic <= 3
              ? 'MODERATE'
              : 'HIGH',
        contraindications: [...item.exercise.contraindicationTags],
        primaryMuscles: [...item.exercise.primaryMuscles],
        secondaryMuscles: [...item.exercise.secondaryMuscles],
        techniqueReviewStatus: 'PENDING_REVIEW',
        programmingRole,
        programmingSlotId: programmingSlot?.id,
        programmingSetCap: programmingSlot?.maximumSets,
        keyExercise: roleStructure ? programmingRole === 'PRIMARY' : index < 2,
        dose: {
          kind: 'STRENGTH_SETS',
          sets: dose.sets,
          repetitions,
          restSeconds: dose.restSeconds,
          targetRpe: Math.max(5, 10 - targetRir),
          targetRir,
        },
      },
    ]
  })
  const exercises = baseExercises
  if (exercises.length === 0) {
    throw new Error('UNSUPPORTED_PRESCRIPTION:NO_SAFE_STRENGTH_DOSE_AVAILABLE')
  }
  const structuralConstraintReasonCodes = (() => {
    if (!roleStructure) return []
    const missingSlots = roleStructure.slots.filter(
      (roleSlot) =>
        !exercises.some((exercise) => exercise.programmingSlotId === roleSlot.id),
    )
    if (missingSlots.length === 0) return []
    const rejectedReasons = eligibility
      .filter((item) =>
        missingSlots.some((roleSlot) =>
          item.exercise.movementPatterns.includes(roleSlot.movementPattern),
        ),
      )
      .flatMap((item) => item.reasonCodes)
    const reasons: string[] = []
    if (rejectedReasons.includes('CONTRAINDICATION_MATCH')) {
      reasons.push(STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_HEALTH_LIMITED)
    }
    if (rejectedReasons.includes('EQUIPMENT_UNAVAILABLE')) {
      reasons.push(STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_EQUIPMENT_LIMITED)
    }
    if (
      rejectedReasons.some((reason) =>
        [
          'EXPERIENCE_NOT_MET',
          'TECHNICAL_COMPLEXITY_TOO_HIGH',
          'SUPERVISION_REQUIRED',
        ].includes(reason),
      )
    ) {
      reasons.push(STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_EXPERIENCE_LIMITED)
    }
    if (chosen.length > exercises.length) {
      reasons.push(STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_VOLUME_LIMITED)
    }
    return [...new Set(reasons)]
  })()
  const initialStructureDecision = roleStructure
    ? evaluateStrengthRoleStructure({
        structure: roleStructure,
        exercises,
        constraintReasonCodes: structuralConstraintReasonCodes,
      })
    : undefined
  const ruleIds = [
    'ADULT-ONLY-001',
    ...new Set(doses.flatMap((dose) => dose.ruleIds)),
    'RT-NO-FAILURE-001',
    'RT-PROGRESSION-001',
    STRENGTH_VOLUME_POLICY_VERSION,
    ADULT_STRENGTH_TIME_POLICY_VERSION,
    STRENGTH_RETURN_POLICY_VERSION,
    ...returnDecision.reasonCodes,
    ...(initialStructureDecision?.reasonCodes ?? []),
  ]
  const evidenceClaimIds = [...new Set(doses.flatMap((dose) => dose.evidenceClaimIds))]
  const unfitted = withV2Blocks({
    id: input.sessionId,
    title: input.title,
    kind: 'STRENGTH',
    goal: input.context.goal,
    durationMinutes: input.context.availableMinutes,
    timeBudgetMinutes: input.context.availableMinutes,
    strengthRoleStructure: initialStructureDecision,
    objective,
    warmupMinutes,
    warmup: [
      `${warmupMinutes} min rauhallista yleislämmittelyä`,
      'Tee päivän ensimmäisestä liikkeestä kevyt kalibroiva harjoitussarja.',
    ],
    exercises,
    cooldownMinutes,
    cooldown: [`${cooldownMinutes} min rauhallista liikettä ja hengityksen tasaus`],
    progression:
      'Toistoa voidaan lisätä yhden onnistuneen harjoituskerran jälkeen. Kuormaa nostetaan vasta kahden eri, vertailukelpoisen ja onnistuneen harjoituskerran jälkeen, yksi muuttuja kerrallaan.',
    decisionTrace: {
      ruleVersion: input.context.ruleVersion,
      engineVersion: ADULT_RESISTANCE_ENGINE_VERSION,
      contentReleaseId: catalog.getReleaseId(),
      generatedAt: input.context.generatedAt,
      safetyOutcome:
        input.context.limitationTags.length ||
        input.context.physicalLoad === 'HIGH' ||
        input.context.readiness === 'YELLOW'
          ? 'MODIFY'
          : 'PROCEED',
      confidence: capabilities.some((item) => item.confidence === 'LOW')
        ? 'LOW'
        : 'MODERATE',
      inputSummary: [
        `Ikä: ${input.context.age}`,
        `Kokemus: ${input.context.experience}`,
        `Tavoite: ${input.context.goal}`,
        `Aika: ${input.context.availableMinutes} min`,
        `Ympäristö: ${input.context.environment}`,
        `Välineet: ${input.context.equipment.join(', ')}`,
        `Fyysinen arjen kuorma: ${input.context.physicalLoad}`,
        `Päivän valmius: ${input.context.readiness}`,
        `Rajoitetagit: ${input.context.limitationTags.join(', ') || 'ei ilmoitettu'}`,
        `Mieluisat liikkeet: ${input.context.likedExerciseCodes.join(', ') || 'ei ilmoitettu'}`,
        `Vältettävät liikkeet: ${input.context.dislikedExerciseCodes.join(', ') || 'ei ilmoitettu'}`,
        `Historiallisia sarjoja: ${history.length}`,
        `Tauolta paluun tila: ${returnDecision.state}`,
        `Tauko: ${returnDecision.breakDays ?? 'ei vahvistettua tietoa'} päivää`,
      ],
      missingData: capabilities
        .filter((item) => item.calibrationRequired)
        .map(
          (item) => `${item.exerciseCode}: vertailukelpoinen kuorma–toistot–RIR-historia`,
        ),
      rules: ruleIds.map((ruleId) => {
        const publishedRule = catalog
          .listPublishedRules()
          .find((rule) => rule.id === ruleId)
        return {
          ruleId,
          outcome: ruleId === 'RT-CALIBRATION-001' ? 'MODIFY' : 'PROCEED',
          message:
            ruleId === 'RT-CALIBRATION-001'
              ? 'Kuorma kalibroidaan ilman näennäisen tarkkaa kilogrammamäärää.'
              : 'Annostus pysyy julkaistun aikuisten voimaharjoittelusäännön sisällä.',
          evidenceIds: [...(publishedRule?.claimIds ?? [])],
        }
      }),
      sessionObjective: objective,
      evidenceClaimIds,
      ruleIds,
      selectedExercises: exercises.map((exercise) => {
        const score = scores.find((item) => item.exercise.code === exercise.code)!
        return {
          code: exercise.code,
          version: catalog.getExercise(exercise.code)?.version ?? '1.0.0',
          scoreComponents: score.scoreComponents,
        }
      }),
      rejectedExercises: [
        ...eligibility
          .filter((item) => !item.eligible)
          .map((item) => ({
            code: item.exercise.code,
            reasonCodes: item.reasonCodes,
          })),
        ...scores
          .filter(
            (candidate) =>
              !exercises.some((exercise) => exercise.code === candidate.exercise.code),
          )
          .map((candidate) => ({
            code: candidate.exercise.code,
            reasonCodes: ['NOT_SELECTED_HIGHER_RANKED_CANDIDATE'],
          })),
      ],
      capabilityEstimates: capabilities.filter((capability) =>
        exercises.some((exercise) => exercise.code === capability.exerciseCode),
      ),
      adaptations: exercises.map((exercise) => ({
        original: {
          exerciseCode: exercise.code,
          exerciseVersion: exercise.contentVersion ?? null,
          supportingSessionIds: exercise.progressionDecision?.supportingSessionIds ?? [],
        },
        adjusted: {
          action: exercise.progressionDecision?.action ?? 'RECALIBRATE_LOAD',
          nextLoadKg: exercise.progressionDecision?.nextLoadKg ?? null,
          nextRepetitions: exercise.progressionDecision?.nextRepetitions ?? null,
        },
        reasonCodes: exercise.progressionDecision?.reasonCodes ?? [
          'NO_COMPARABLE_SESSION_HISTORY',
        ],
      })),
      strengthReturn: returnDecision,
    },
  })
  const fitted = fitStrengthPrescriptionToTimeBudget({
    prescription: unfitted,
    timeBudgetMinutes: input.context.availableMinutes,
  })
  if (fitted.status === 'UNSUPPORTED') {
    throw new Error('UNSUPPORTED_PRESCRIPTION:NO_SAFE_STRENGTH_DOSE_AVAILABLE')
  }
  const fittedStructureDecision = roleStructure
    ? evaluateStrengthRoleStructure({
        structure: roleStructure,
        exercises: fitted.prescription.exercises,
        constraintReasonCodes: [
          ...structuralConstraintReasonCodes,
          ...(fitted.prescription.exercises.length < exercises.length
            ? [STRENGTH_WEEK_REASON_CODES.ROLE_STRUCTURE_TIME_LIMITED]
            : []),
        ],
      })
    : undefined
  const fittedPrescription = {
    ...fitted.prescription,
    strengthRoleStructure: fittedStructureDecision,
  }
  if (!returnDecision.progressionSuppressed) return fittedPrescription

  const returnedExercises = applyReturnDose(
    fittedPrescription.exercises,
    returnDecision,
    history,
  )
  const returned = fitStrengthPrescriptionToTimeBudget({
    prescription: {
      ...fitted.prescription,
      strengthRoleStructure: fittedStructureDecision,
      minimumTimeBufferSeconds: fittedPrescription.timeBreakdown?.bufferSeconds,
      exercises: returnedExercises,
      blocks: returnedExercises,
      decisionTrace: {
        ...fitted.prescription.decisionTrace,
        adaptations: [
          ...(fitted.prescription.decisionTrace.adaptations ?? []),
          {
            original: fitted.prescription.exercises.map((exercise) => ({
              code: exercise.code,
              sets: exercise.sets,
              repetitions: exercise.repetitions ?? null,
              targetRir: exercise.targetRir ?? null,
            })),
            adjusted: returnedExercises.map((exercise) => ({
              code: exercise.code,
              sets: exercise.sets,
              repetitions: exercise.repetitions ?? null,
              targetRirRange: exercise.targetRirRange ?? null,
            })),
            reasonCodes: returnDecision.reasonCodes,
          },
        ],
      },
    },
    timeBudgetMinutes: input.context.availableMinutes,
    initialReasonCodes: returnDecision.reasonCodes,
  })
  if (returned.status === 'UNSUPPORTED') {
    throw new Error('UNSUPPORTED_PRESCRIPTION:NO_SAFE_STRENGTH_DOSE_AVAILABLE')
  }
  return returned.prescription
}

export function adaptNextSet(input: {
  prescribedLoadKg?: number
  prescribedRepetitions: number
  targetRir: [number, number]
  completedLoadKg?: number
  completedRepetitions: number
  completedRir?: number
  pain: SetPainResponse | 'MODERATE'
  techniqueOk: boolean
  experience: ExperienceLevel
  /** Vain kutsuhetkellä varmasti tunnettu välineporras; puuttuva arvo toimii fail closed. */
  loadIncrementKg?: number
}): SetAdaptationDecision {
  if (input.pain === 'SEVERE')
    return { action: 'REFER_SAFETY', reasonCodes: ['SEVERE_PAIN_REPORTED'] }
  if (
    input.pain === 'MODERATE' ||
    input.pain === 'WORSENING' ||
    input.pain === 'SHARP' ||
    input.pain === 'FUNCTION_ALTERING' ||
    !input.techniqueOk
  )
    return {
      action: 'STOP_EXERCISE',
      reasonCodes: [
        input.pain === 'WORSENING'
          ? 'PAIN_WORSENING'
          : input.pain === 'SHARP'
            ? 'SHARP_PAIN_REPORTED'
            : input.pain === 'FUNCTION_ALTERING'
              ? 'PAIN_ALTERS_FUNCTION'
              : input.pain === 'MODERATE'
                ? 'PAIN_REPORTED'
                : 'TECHNIQUE_DEGRADED',
      ],
    }
  if (input.completedRir === undefined)
    return { action: 'MAINTAIN', reasonCodes: ['RIR_MISSING'] }
  if (input.completedRir < input.targetRir[0]) {
    const adjustedLoadKg =
      input.completedLoadKg &&
      typeof input.loadIncrementKg === 'number' &&
      Number.isFinite(input.loadIncrementKg) &&
      input.loadIncrementKg > 0
        ? Math.max(0, input.completedLoadKg - input.loadIncrementKg)
        : undefined
    return {
      action:
        adjustedLoadKg === undefined ? 'REDUCE_REPETITIONS' : 'DECREASE_ONE_INCREMENT',
      adjustedLoadKg,
      adjustedRepetitions:
        adjustedLoadKg === undefined
          ? Math.max(1, input.completedRepetitions - 1)
          : undefined,
      reasonCodes: ['SET_HARDER_THAN_TARGET_RIR'],
    }
  }
  if (
    input.completedRir > input.targetRir[1] + 1 &&
    input.techniqueOk &&
    input.experience !== 'BEGINNER'
  ) {
    const nextLoadKg =
      input.completedLoadKg === undefined ||
      typeof input.loadIncrementKg !== 'number' ||
      !Number.isFinite(input.loadIncrementKg) ||
      input.loadIncrementKg <= 0
        ? null
        : nextAutomaticLoadKg(input.completedLoadKg, input.loadIncrementKg)
    if (nextLoadKg === null) {
      return {
        action:
          input.completedRepetitions < input.prescribedRepetitions
            ? 'INCREASE_REPETITIONS'
            : 'MAINTAIN',
        adjustedRepetitions:
          input.completedRepetitions < input.prescribedRepetitions
            ? input.completedRepetitions + 1
            : undefined,
        reasonCodes: [
          typeof input.loadIncrementKg === 'number'
            ? 'LOAD_INCREMENT_EXCEEDS_TEN_PERCENT'
            : 'LOAD_ADJUSTMENT_NOT_VERIFIED',
        ],
      }
    }
    return {
      action: 'INCREASE_ONE_INCREMENT',
      adjustedLoadKg: nextLoadKg,
      reasonCodes: ['SET_EASIER_THAN_TARGET_RIR', 'ONE_AVAILABLE_INCREMENT'],
    }
  }
  return { action: 'MAINTAIN', reasonCodes: ['SET_WITHIN_TARGET_RIR'] }
}

export function decideInterSessionProgression(input: {
  comparableSessions: readonly AdultResistanceSetHistory[]
  targetRir: [number, number]
  verifiedNextLoads?: readonly VerifiedNextLoad[]
  /** @deprecated Hyväksytään kutsusopimuksessa vain legacy-yhteensopivuutta varten; ei valtuuta progressiota. */
  loadIncrementKg?: number
  targetExerciseCode?: string
  targetExerciseVersion?: string
  targetLoadType?: ExerciseLoadType
  targetLoadContextId?: string
  maximumRepetitions?: number
  generatedAt?: string
}): InterSessionProgressionDecision {
  if (!input.targetExerciseCode || !input.targetExerciseVersion) {
    return {
      action: 'RECALIBRATE_LOAD',
      changedVariable: 'NONE',
      reasonCodes: ['EXERCISE_IDENTITY_AND_VERSION_REQUIRED'],
      supportingSessionIds: [],
    }
  }
  if (!input.generatedAt || !Number.isFinite(Date.parse(input.generatedAt))) {
    return {
      action: 'RECALIBRATE_LOAD',
      changedVariable: 'NONE',
      reasonCodes: ['EVALUATION_TIME_REQUIRED'],
      supportingSessionIds: [],
    }
  }
  const targetLoadType = input.targetLoadType ?? 'EXTERNAL_KG'
  const kilogramLoad = isKilogramLoadType(targetLoadType)
  if (kilogramLoad && !input.targetLoadContextId) {
    return {
      action: 'RECALIBRATE_LOAD',
      changedVariable: 'NONE',
      reasonCodes: ['COMPARABLE_LOAD_CONTEXT_REQUIRED'],
      supportingSessionIds: [],
    }
  }
  const generatedAtMs = Date.parse(input.generatedAt)
  const matchingIdentity = input.comparableSessions.filter((item) => {
    const ageDays = historyAgeDays(item.completedAt, generatedAtMs)
    return (
      item.exerciseCode === input.targetExerciseCode &&
      item.exerciseVersion === input.targetExerciseVersion &&
      ageDays >= 0 &&
      ageDays <= 56
    )
  })
  const identifiedHistory = matchingIdentity.filter((item) => item.sessionId)
  if (matchingIdentity.length > 0 && identifiedHistory.length === 0) {
    return {
      action: 'RECALIBRATE_LOAD',
      changedVariable: 'NONE',
      reasonCodes: ['SESSION_IDENTITY_REQUIRED'],
      supportingSessionIds: [],
    }
  }
  const sameContext = identifiedHistory.filter(
    (item) =>
      item.loadType === targetLoadType &&
      (kilogramLoad ? item.loadContextId === input.targetLoadContextId : true),
  )
  if (sameContext.length === 0) {
    return {
      action: 'RECALIBRATE_LOAD',
      changedVariable: 'NONE',
      reasonCodes: [
        matchingIdentity.length > 0
          ? 'COMPARABLE_LOAD_CONTEXT_REQUIRED'
          : 'NO_COMPARABLE_SESSION_HISTORY',
      ],
      supportingSessionIds: [],
    }
  }
  const exposures = [...groupBySession(sameContext).entries()]
    .map(([sessionId, sets]) => {
      const sorted = [...sets].sort((left, right) =>
        left.completedAt.localeCompare(right.completedAt),
      )
      const completedAt = sorted.at(-1)!.completedAt
      const loads = sorted
        .map((item) => item.loadKg)
        .filter((value): value is number => typeof value === 'number' && value > 0)
      const repetitions = Math.min(...sorted.map((item) => item.repetitions))
      const success = sorted.every(
        (item) =>
          item.completionStatus === 'COMPLETED' &&
          item.doseCompleted === true &&
          !item.pain &&
          item.techniqueOk === true &&
          typeof item.rir === 'number' &&
          item.rir >= input.targetRir[0] &&
          item.rir <= input.targetRir[1] &&
          item.repetitions > 0 &&
          item.severeDomsDeload !== true,
      )
      const sameLoad =
        !kilogramLoad || (loads.length === sorted.length && new Set(loads).size === 1)
      return {
        sessionId,
        completedAt,
        repetitions,
        loadKg: kilogramLoad && sameLoad ? loads[0] : undefined,
        success: success && sameLoad,
      }
    })
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
  const latest = exposures.at(-1)
  if (!latest || !latest.success) {
    return {
      action: 'KEEP_LOAD',
      changedVariable: 'NONE',
      reasonCodes: [latest ? 'SUCCESS_STREAK_BROKEN' : 'NO_COMPARABLE_SESSION_HISTORY'],
      supportingSessionIds: latest ? [latest.sessionId] : [],
    }
  }
  if (
    input.maximumRepetitions !== undefined &&
    latest.repetitions < input.maximumRepetitions
  ) {
    return {
      action: 'INCREASE_REPETITIONS',
      nextLoadKg: latest.loadKg,
      nextRepetitions: latest.repetitions + 1,
      changedVariable: 'REPETITIONS',
      reasonCodes: ['ONE_SUCCESSFUL_DISTINCT_SESSION', 'BELOW_REPETITION_MAXIMUM'],
      supportingSessionIds: [latest.sessionId],
    }
  }
  const successStreak = [latest]
  for (let index = exposures.length - 2; index >= 0; index -= 1) {
    const exposure = exposures[index]!
    if (!exposure.success) break
    successStreak.unshift(exposure)
  }
  const latestTwo = successStreak.slice(-2)
  const sameLoad =
    latestTwo.length === 2 &&
    latestTwo.every((item) => item.loadKg === latest.loadKg) &&
    latest.loadKg !== undefined
  if (kilogramLoad && latestTwo.length >= 2 && sameLoad) {
    const currentLoadKg = latest.loadKg!
    const verifiedNextLoad = findVerifiedNextLoad(
      input.verifiedNextLoads ?? [],
      {
        exerciseCode: input.targetExerciseCode,
        exerciseVersion: input.targetExerciseVersion,
        loadType: targetLoadType,
        loadContextId: input.targetLoadContextId,
        currentLoadKg,
      },
      {
        evaluatedAt: input.generatedAt,
        supportingEvidenceAt: latest.completedAt,
      },
    )
    if (!verifiedNextLoad) {
      return {
        action: 'KEEP_LOAD',
        currentLoadKg,
        nextLoadKg: currentLoadKg,
        changedVariable: 'NONE',
        reasonCodes: ['NEXT_AVAILABLE_LOAD_NOT_CONFIRMED'],
        supportingSessionIds: latestTwo.map((item) => item.sessionId),
      }
    }
    if (
      !isAutomaticLoadIncreaseAllowed(currentLoadKg, verifiedNextLoad.nextAvailableLoadKg)
    ) {
      return {
        action: 'KEEP_LOAD',
        currentLoadKg,
        nextLoadKg: currentLoadKg,
        changedVariable: 'NONE',
        reasonCodes: ['VERIFIED_NEXT_LOAD_EXCEEDS_TEN_PERCENT'],
        supportingSessionIds: latestTwo.map((item) => item.sessionId),
      }
    }
    return {
      action: 'INCREASE_LOAD',
      currentLoadKg,
      nextLoadKg: verifiedNextLoad.nextAvailableLoadKg,
      changedVariable: 'LOAD',
      reasonCodes: [
        'TWO_SUCCESSFUL_DISTINCT_SESSIONS_AT_REPETITION_MAXIMUM',
        'USER_CONFIRMED_NEXT_AVAILABLE_LOAD',
      ],
      supportingSessionIds: latestTwo.map((item) => item.sessionId),
    }
  }
  return {
    action: 'KEEP_LOAD',
    nextLoadKg: latest.loadKg,
    changedVariable: 'NONE',
    reasonCodes: [
      kilogramLoad
        ? 'FEWER_THAN_TWO_SUCCESSFUL_DISTINCT_SESSIONS_AT_REPETITION_MAXIMUM'
        : 'NON_KILOGRAM_LOAD_HAS_NO_AUTOMATIC_KG_PROGRESSION',
    ],
    supportingSessionIds: [latest.sessionId],
  }
}

export const AdultResistanceEngine = {
  objective: createResistanceSessionObjective,
  filterEligibleExercises,
  scoreExerciseCandidates,
  estimateCapability: estimateAdultResistanceCapability,
  prescribeDose: prescribeResistanceDose,
  prescribe: prescribeAdultResistanceSession,
  adaptNextSet,
  decideProgression: decideInterSessionProgression,
}
