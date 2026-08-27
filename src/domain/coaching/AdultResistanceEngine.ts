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
  ExerciseLoadType,
  ExercisePrescription,
  ExperienceLevel,
  GoalType,
  PrescribedSession,
  SetPainResponse,
  SessionObjective,
} from './types'
import { evaluateStrengthSafetyGate } from './StrengthSafetyGate'
import {
  STRENGTH_VOLUME_POLICY_VERSION,
  addPlannedSets,
  calculateRollingMuscleVolume,
  maximumAdditionalSets,
  type MuscleVolume,
} from './StrengthVolumePolicy'

export const ADULT_RESISTANCE_ENGINE_VERSION = 'adult-resistance-1.1.0'
export const ADULT_RESISTANCE_RULE_VERSION = 'adult-resistance-rules-1.1.0'

const experienceRank: Record<ExperienceLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
}

export type AdultResistanceSetHistory = {
  exerciseCode: string
  exerciseVersion?: string
  movementPatterns?: readonly string[]
  primaryMuscles?: readonly string[]
  secondaryMuscles?: readonly string[]
  loadKg: number | null
  repetitions: number
  rir?: number | null
  completedAt: string
  pain?: boolean
  techniqueOk?: boolean
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
  action:
    | 'MAINTAIN_AND_COLLECT_MORE_DATA'
    | 'INCREASE_LOAD'
    | 'INCREASE_REPETITIONS'
    | 'DECREASE_LOAD'
  nextLoadKg?: number
  nextRepetitions?: number
  changedVariable: 'NONE' | 'LOAD' | 'REPETITIONS'
  reasonCodes: string[]
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
  const requiredMovementPatterns = [
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
    optionalMovementPatterns: [
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
    const movementFit = exercise.movementPatterns.some((pattern) =>
      sessionObjective.requiredMovementPatterns?.includes(pattern),
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
      const recentSuccesses = history.filter(
        (item) =>
          item.exerciseCode === exercise.code && !item.pain && item.techniqueOk !== false,
      ).length
      const scoreComponents = {
        adaptationFit: exercise.adaptationTargets.includes(
          sessionObjective.primaryAdaptation ?? '',
        )
          ? 20
          : 8,
        movementPatternFit: exercise.movementPatterns.some((pattern) =>
          sessionObjective.requiredMovementPatterns?.includes(pattern),
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

export function estimateAdultResistanceCapability(
  exercise: ExerciseDefinition,
  history: readonly AdultResistanceSetHistory[],
  generatedAt: string,
  experience: ExperienceLevel,
): CapabilityEstimate {
  const now = Date.parse(generatedAt)
  const primaryMovementPattern = exercise.movementPatterns[0]
  const supportsComparableKilograms = exercise.loadTypes.some((loadType) =>
    ['EXTERNAL_KG', 'DUMBBELL_KG_EACH', 'MACHINE_KG'].includes(loadType),
  )
  if (!supportsComparableKilograms) {
    return {
      exerciseCode: exercise.code,
      confidence: 'LOW',
      supportingSetCount: 0,
      calibrationRequired: true,
      reasons: ['LOAD_TYPE_NOT_COMPARABLE_IN_KILOGRAMS', 'PRECISE_LOAD_WITHHELD'],
    }
  }
  const exerciseSets = history.filter((item) => {
    const ageDays = (now - Date.parse(item.completedAt)) / 86_400_000
    return (
      item.exerciseCode === exercise.code &&
      item.loadKg &&
      item.loadKg > 0 &&
      item.repetitions > 0 &&
      item.repetitions <= 15 &&
      ageDays >= 0 &&
      ageDays <= 180 &&
      !item.pain &&
      item.techniqueOk !== false
    )
  })
  const valid = exerciseSets.filter((item) => item.rir !== null && item.rir !== undefined)
  const support = valid.length
  if (support < 2) {
    const movementFamilySupport = history.filter((item) => {
      const ageDays = (now - Date.parse(item.completedAt)) / 86_400_000
      return (
        item.exerciseCode !== exercise.code &&
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
      supportingSetCount: support + movementFamilySupport,
      latestValidSetAt: exerciseSets
        .map((item) => item.completedAt)
        .sort()
        .at(-1),
      calibrationRequired: true,
      reasons: [
        'COMPARABLE_EXERCISE_RIR_SETS_BELOW_TWO',
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
  const latestAgeDays = (now - Date.parse(latestValidSetAt)) / 86_400_000
  if (latestAgeDays > 90) {
    return {
      exerciseCode: exercise.code,
      confidence: 'LOW',
      supportingSetCount: support,
      latestValidSetAt,
      calibrationRequired: true,
      reasons: ['COMPARABLE_HISTORY_OLDER_THAN_NINETY_DAYS', 'PRECISE_LOAD_WITHHELD'],
    }
  }
  const estimates = valid.map(
    (item) => item.loadKg! * (1 + (item.repetitions + (item.rir ?? 0)) / 30),
  )
  const estimated1RmKg = roundToIncrement(
    estimates.reduce((total, value) => total + value, 0) / estimates.length,
    0.5,
  )
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
      support >= 4 &&
      experience !== 'BEGINNER' &&
      latestAgeDays <= 45 &&
      !exercise.loadTypes.includes('MACHINE_KG')
        ? 'HIGH'
        : 'MODERATE',
    supportingSetCount: support,
    latestValidSetAt,
    calibrationRequired: false,
    reasons: [
      'RECENT_COMPARABLE_LOAD_REPS_RIR_USED',
      'ESTIMATE_NOT_MEASURED_MAXIMUM',
      ...(exercise.loadTypes.includes('MACHINE_KG')
        ? ['MACHINE_LOAD_NOT_COMPARABLE_ACROSS_DEVICES']
        : []),
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
  const repetitions: [number, number] = strengthGoal
    ? [4, 6]
    : hypertrophyGoal
      ? [6, 12]
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

function loadTracking(exercise: ExerciseDefinition): {
  loadType: ExerciseLoadType
  loadLabelFi: string
  loadOptions?: string[]
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
    return { loadType: 'DUMBBELL_KG_EACH', loadLabelFi: 'Kuorma kg / käsipaino' }
  if (available === 'MACHINE_KG')
    return { loadType: 'MACHINE_KG', loadLabelFi: 'Laitteen kuorma kg' }
  return { loadType: 'EXTERNAL_KG', loadLabelFi: 'Kuorma kg' }
}

function selectedPatternOrder(minutes: number) {
  if (minutes <= 20) return ['SQUAT', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL']
  if (minutes <= 30) return ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL']
  return ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'HORIZONTAL_PULL', 'ANTI_EXTENSION']
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
    exerciseVersion:
      item.exerciseVersion ?? catalog.getExercise(item.exerciseCode)?.version,
    primaryMuscles:
      item.primaryMuscles ?? catalog.getExercise(item.exerciseCode)?.primaryMuscles,
    secondaryMuscles:
      item.secondaryMuscles ?? catalog.getExercise(item.exerciseCode)?.secondaryMuscles,
  }))
  const objective = createResistanceSessionObjective(input.context)
  const eligibility = filterEligibleExercises(catalog, input.context, objective)
  const eligible = eligibility
    .filter((item) => item.eligible)
    .map((item) => item.exercise)
  const scores = scoreExerciseCandidates(eligible, input.context, objective, history)
  const chosen: ExerciseCandidateScore[] = []
  for (const pattern of selectedPatternOrder(input.context.availableMinutes)) {
    const candidate = scores.find(
      (item) =>
        item.exercise.movementPatterns.includes(pattern) && !chosen.includes(item),
    )
    if (candidate) chosen.push(candidate)
  }
  const capabilities = chosen.map((item) =>
    estimateAdultResistanceCapability(
      item.exercise,
      history,
      input.context.generatedAt,
      input.context.experience,
    ),
  )
  const generatedAtMs = Date.parse(input.context.generatedAt)
  const doses = chosen.map((item, index) => {
    const comparableSetsThisWeek = history.filter((set) => {
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
    return prescribeResistanceDose(
      objective,
      item.exercise,
      capabilities[index]!,
      input.context,
      { comparableSetsThisWeek },
    )
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
      }),
    )
    if (dose.sets > 0) {
      addPlannedSets({
        exercise: item.exercise,
        sets: dose.sets,
        rollingVolume,
        sessionPrimaryVolume,
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
  const exercises: ExercisePrescription[] = chosen.flatMap((item, index) => {
    const dose = doses[index]!
    if (dose.sets <= 0) return []
    const repetitions = Array.isArray(dose.repetitions)
      ? `${dose.repetitions[0]}–${dose.repetitions[1]}`
      : String(dose.repetitions)
    const targetRir = Array.isArray(dose.targetRir) ? dose.targetRir[0] : dose.targetRir
    const load = loadTracking(item.exercise)
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
        estimatedWorkSetSeconds: ADULT_STRENGTH_TIME_POLICY.workSetSeconds,
        loadGuidance: dose.calibrationRequired
          ? 'Aloita kevyellä kalibroivalla sarjalla. Valitse kuorma, jolla tavoitetoistot onnistuvat hallitusti ja toistoja jää tavoitealueen verran varastoon.'
          : `Suositeltu työkuorma on arviolta ${dose.prescribedLoadRangeKg?.[0]}–${dose.prescribedLoadRangeKg?.[1]} kg. Arvio ei ole mitattu maksimi.`,
        stopCondition:
          'Keskeytä, jos liike provosoi kipua tai tekniikka ei pysy hallittuna.',
        substitutions,
        ...load,
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
        keyExercise: index < 2,
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
  if (exercises.length === 0) {
    throw new Error('UNSUPPORTED_PRESCRIPTION:NO_SAFE_STRENGTH_DOSE_AVAILABLE')
  }
  const ruleIds = [
    'ADULT-ONLY-001',
    ...new Set(doses.flatMap((dose) => dose.ruleIds)),
    'RT-NO-FAILURE-001',
    'RT-PROGRESSION-001',
    STRENGTH_VOLUME_POLICY_VERSION,
    ADULT_STRENGTH_TIME_POLICY_VERSION,
  ]
  const evidenceClaimIds = [...new Set(doses.flatMap((dose) => dose.evidenceClaimIds))]
  const unfitted = withV2Blocks({
    id: input.sessionId,
    title: input.title,
    kind: 'STRENGTH',
    goal: input.context.goal,
    durationMinutes: input.context.availableMinutes,
    timeBudgetMinutes: input.context.availableMinutes,
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
      'Kuormaa muutetaan vasta vähintään kahden vertailukelpoisen, kivuttoman ja tavoite-RIR:ään osuneen harjoituksen jälkeen, yksi muuttuja kerrallaan.',
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
      adaptations: [],
    },
  })
  const fitted = fitStrengthPrescriptionToTimeBudget({
    prescription: unfitted,
    timeBudgetMinutes: input.context.availableMinutes,
  })
  if (fitted.status === 'UNSUPPORTED') {
    throw new Error('UNSUPPORTED_PRESCRIPTION:NO_SAFE_STRENGTH_DOSE_AVAILABLE')
  }
  return fitted.prescription
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
  loadIncrementKg: number
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
    const adjustedLoadKg = input.completedLoadKg
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
      input.completedLoadKg === undefined
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
        reasonCodes: ['LOAD_INCREMENT_EXCEEDS_TEN_PERCENT'],
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
  comparableSessions: {
    exerciseCode?: string
    exerciseVersion?: string
    loadKg?: number
    repetitions: number
    rir: number
    pain: boolean
    techniqueOk: boolean
  }[]
  targetRir: [number, number]
  loadIncrementKg: number
  targetExerciseCode?: string
  targetExerciseVersion?: string
  maximumRepetitions?: number
}): InterSessionProgressionDecision {
  if (!input.targetExerciseCode || !input.targetExerciseVersion) {
    return {
      action: 'MAINTAIN_AND_COLLECT_MORE_DATA',
      changedVariable: 'NONE',
      reasonCodes: ['EXERCISE_IDENTITY_AND_VERSION_REQUIRED'],
    }
  }
  const comparable = input.comparableSessions.filter(
    (item) =>
      (input.targetExerciseCode === undefined ||
        item.exerciseCode === input.targetExerciseCode) &&
      (input.targetExerciseVersion === undefined ||
        item.exerciseVersion === input.targetExerciseVersion) &&
      !item.pain &&
      item.techniqueOk &&
      item.rir >= input.targetRir[0] &&
      item.rir <= input.targetRir[1],
  )
  if (comparable.length < 2)
    return {
      action: 'MAINTAIN_AND_COLLECT_MORE_DATA',
      changedVariable: 'NONE',
      reasonCodes: ['FEWER_THAN_TWO_COMPARABLE_SUCCESSES'],
    }
  const latest = comparable.at(-1)!
  if (latest.loadKg !== undefined) {
    const nextLoadKg = nextAutomaticLoadKg(latest.loadKg, input.loadIncrementKg)
    if (nextLoadKg === null) {
      if (
        input.maximumRepetitions !== undefined &&
        latest.repetitions < input.maximumRepetitions
      ) {
        return {
          action: 'INCREASE_REPETITIONS',
          nextRepetitions: latest.repetitions + 1,
          changedVariable: 'REPETITIONS',
          reasonCodes: ['TWO_COMPARABLE_SUCCESSES', 'LOAD_INCREMENT_EXCEEDS_TEN_PERCENT'],
        }
      }
      return {
        action: 'MAINTAIN_AND_COLLECT_MORE_DATA',
        changedVariable: 'NONE',
        reasonCodes: ['LOAD_INCREMENT_EXCEEDS_TEN_PERCENT'],
      }
    }
    return {
      action: 'INCREASE_LOAD',
      nextLoadKg,
      changedVariable: 'LOAD',
      reasonCodes: ['TWO_COMPARABLE_SUCCESSES', 'ONE_AVAILABLE_INCREMENT'],
    }
  }
  return {
    action: 'INCREASE_REPETITIONS',
    nextRepetitions: latest.repetitions + 1,
    changedVariable: 'REPETITIONS',
    reasonCodes: ['TWO_COMPARABLE_SUCCESSES', 'BODYWEIGHT_REPETITION_PROGRESSION'],
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
