export type GoalType =
  | 'BODY_RECOMPOSITION'
  | 'FAT_LOSS'
  | 'MUSCLE_GAIN'
  | 'MAX_STRENGTH'
  | 'ENDURANCE'
  | 'SPEED_POWER'
  | 'GENERAL_FITNESS'
  | 'POSTURE_MOBILITY'
  | 'SPORT_PERFORMANCE'

export type DecisionPriority =
  | 'SAFETY'
  | 'COACH_FIXED'
  | 'TIME'
  | 'PRIMARY_GOAL'
  | 'SECONDARY_GOAL'
  | 'RECOVERY'
  | 'PREFERENCE'

export type DecisionReason = {
  code: string
  message: string
  priority: DecisionPriority
}

export type ExplainableDecision<T> = {
  decision: T
  reasons: DecisionReason[]
  warnings: string[]
}

export type SafetyOutcome = 'PROCEED' | 'MODIFY' | 'STOP' | 'REFER'

export type RuleDecision = {
  ruleId: string
  outcome: SafetyOutcome
  message: string
  evidenceIds: string[]
}

export type DecisionTraceValue =
  | string
  | number
  | boolean
  | null
  | DecisionTraceValue[]
  | { [key: string]: DecisionTraceValue }

export type DecisionTrace = {
  ruleVersion: string
  engineVersion?: string
  contentReleaseId?: string
  generatedAt: string
  safetyOutcome: SafetyOutcome
  confidence: 'HIGH' | 'MODERATE' | 'LOW'
  inputSummary: string[]
  missingData: string[]
  rules: RuleDecision[]
  sessionObjective?: SessionObjective
  evidenceClaimIds?: string[]
  ruleIds?: string[]
  selectedExercises?: {
    code: string
    version: string
    scoreComponents: Record<string, number>
  }[]
  rejectedExercises?: { code: string; reasonCodes: string[] }[]
  capabilityEstimates?: CapabilityEstimate[]
  adaptations?: {
    original: DecisionTraceValue
    adjusted: DecisionTraceValue
    reasonCodes: string[]
  }[]
  /** Versionoitu voimaharjoittelun tauolta paluun päätös. */
  strengthReturn?: StrengthReturnDecisionTrace
  /** Versionoitu viikkosuunnittelun tila, jolla harjoitusrunko muodostettiin. */
  strengthWeek?: StrengthWeekContext
}

export type StrengthReturnState =
  | 'NOVICE_COLD_START'
  | 'ACTIVE'
  | 'BREAK_8_TO_14_DAYS'
  | 'BREAK_15_TO_27_DAYS'
  | 'RETURN_BLOCK_28_TO_55_DAYS'
  | 'RETURNING_56_PLUS_DAYS'

export type StrengthReturnDecisionTrace = {
  state: StrengthReturnState
  policyVersion: string
  source: 'APP_HISTORY' | 'USER_CONFIRMED' | 'NONE'
  breakDays: number | null
  episodeStartedAt: string | null
  approvedReturnWorkoutCount: number
  requiredApprovedWorkoutCount: number
  reentryEndsAt: string | null
  historyAuthorityCutoffAt: string | null
  reasonCodes: string[]
}

export type SessionKind =
  | 'STRENGTH'
  | 'EASY_ENDURANCE'
  | 'INTERVAL'
  | 'SPEED_POWER'
  | 'MOBILITY'
  | 'SPORT'
  | 'MATCH'
  | 'RECOVERY'
  | 'REST'

export type LoadRegion = 'LOWER' | 'UPPER' | 'FULL_BODY' | 'CARDIO' | 'NONE'
export type SessionIntensity = 'EASY' | 'MODERATE' | 'HARD'
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type ConfirmedLimitationTag =
  | 'ACUTE_KNEE_PAIN'
  | 'ACUTE_BACK_PAIN'
  | 'ACUTE_SHOULDER_PAIN'
  | 'ACUTE_WRIST_PAIN'
  | 'GAIT_ALTERING_PAIN'
  | 'OVERHEAD_RESTRICTION'
  | 'ACHILLES_PAIN'
  | 'CALF_INJURY'
  | 'HAMSTRING_INJURY'
export type EnergyFocus =
  | 'MAINTENANCE'
  | 'APPROVED_MODERATE_DEFICIT'
  | 'APPROVED_SMALL_SURPLUS'
  | 'ADEQUATE_ENERGY'
  | 'PERFORMANCE_FUELING'

export type WeeklyRange = {
  min: number
  max: number
}

export type GoalStrategy = {
  id: GoalType
  label: string
  requiredInputs: string[]
  weeklyStructure: Partial<Record<SessionKind, WeeklyRange>>
  keyWorkouts: SessionKind[]
  progression: string[]
  deload: string[]
  nutrition: {
    energyFocus: EnergyFocus
    proteinGramsPerKg?: WeeklyRange
    notes: string[]
  }
  metrics: string[]
  conflictRules: string[]
}

export type GoalProfile = {
  primary: GoalType
  secondary: GoalType[]
  inputs: Record<string, unknown>
}

export type GoalConflictCode =
  | 'FAT_LOSS_VS_MAXIMAL_MUSCLE_GAIN'
  | 'LARGE_DEFICIT_VS_COMPETITION'
  | 'MARATHON_PEAK_VS_MAX_STRENGTH_PEAK'
  | 'RUN_VOLUME_VS_LOWER_HYPERTROPHY'
  | 'SPEED_WHILE_FATIGUED'
  | 'TWO_A_EVENTS'
  | 'WEIGHT_LOSS_VS_LOW_ENERGY'

export type GoalConflict = {
  code: GoalConflictCode
  severity: 'TRADEOFF' | 'BLOCKING'
  message: string
  choices: string[]
}

export type GoalConflictContext = {
  primary: GoalType
  secondary: GoalType[]
  maximalMuscleGainRequested?: boolean
  energyDeficit?: 'NONE' | 'MODERATE' | 'LARGE'
  competitionPeak?: 'NONE' | 'B_EVENT' | 'A_EVENT'
  marathonPeak?: boolean
  maxStrengthPeak?: boolean
  highRunningVolume?: boolean
  highLowerBodyHypertrophy?: boolean
  speedSessionWhileFatigued?: boolean
  simultaneousAEvents?: number
  lowEnergyAvailabilitySigns?: boolean
}

export type PlanVersion = {
  id: string
  goalPeriodId: string
  goal: GoalProfile
  startsOn: string
  createdAt: string
  transitionWeek: boolean
  strategyId: GoalType
}

export type GoalPeriod = {
  id: string
  goal: GoalProfile
  startsOn: string
  endsOn: string | null
  planVersionId: string
}

export type GoalHistory = {
  activePeriodId: string | null
  periods: GoalPeriod[]
  planVersions: PlanVersion[]
}

export type GoalChangePreview = {
  kind: 'GOAL_CHANGE_PREVIEW'
  token: string
  currentGoal: GoalType | null
  proposedGoal: GoalProfile
  startsOn: string
  transitionWeek: boolean
  missingInputs: string[]
  conflicts: GoalConflict[]
  comparison: {
    currentWeeklyStructure: Partial<Record<SessionKind, WeeklyRange>> | null
    proposedWeeklyStructure: Partial<Record<SessionKind, WeeklyRange>>
    currentNutritionFocus: EnergyFocus | null
    proposedNutritionFocus: EnergyFocus
    developed: string[]
    maintained: string[]
    metrics: string[]
  }
}

export type StrengthWeekSessionRole =
  | 'FULL_BODY'
  | 'FULL_BODY_A'
  | 'FULL_BODY_B'
  | 'FULL_BODY_C'
  | 'UPPER_A'
  | 'LOWER_A'
  | 'UPPER_B'
  | 'LOWER_B'

export type StrengthMovementPattern =
  'SQUAT' | 'HINGE' | 'HORIZONTAL_PUSH' | 'HORIZONTAL_PULL' | 'CORE'

export type StrengthWeekContext = {
  policyVersion: string
  weekAnchorDate: string
  role: StrengthWeekSessionRole
  sequenceIndex: number
  plannedExposureCount: number
  completedVolume: Record<string, number>
  plannedVolumeBefore: Record<string, number>
  plannedVolumeAfter: Record<string, number>
  remainingTargetVolume: Record<string, number>
  hardCapRemaining: Record<string, number>
  movementPatternCoverage: StrengthMovementPattern[]
  missingMovementPatterns: StrengthMovementPattern[]
  reasonCodes: string[]
}

export type StrengthWeekPlan = {
  policyVersion: string
  weekAnchorDate: string
  status: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED'
  supportDecision: {
    reasonCode: string
    messageFi: string
    actionFi: string
    evidence: {
      remainingTimeSeconds: number
      minimumPolicyAdditionSeconds: number
      unsupportedSessionCount: number
    }
  }
  targetSessions: number
  appSessionCount: number
  fixedStrengthExposureCount: number
  sessionExposureCount: number
  completedVolume: Record<string, number>
  plannedVolume: Record<string, number>
  remainingTargetVolume: Record<string, number>
  hardCapRemaining: Record<string, number>
  movementPatternCoverage: StrengthMovementPattern[]
  missingMovementPatterns: StrengthMovementPattern[]
  reasonCodes: string[]
}

export type PlannedSession = {
  id: string
  day: number
  kind: SessionKind
  title?: string
  prescription?: string[]
  durationMinutes: number
  /** Päiväkohtainen enimmäisaika; durationMinutes voi olla laskettu toteutusaika. */
  timeBudgetMinutes?: number
  intensity: SessionIntensity
  loadRegion: LoadRegion
  fixed: boolean
  source: 'APP' | 'COACH' | 'SPORT' | 'COMPETITION'
  isNewStimulus?: boolean
  notes?: string[]
  variants?: WorkoutVariant[]
  prescriptionDetail?: PrescribedSession
  unsupportedPrescription?: UnsupportedPrescription
  /** Sama viikkokonteksti säilyy esikatselusta harjoituksen suorittamiseen. */
  strengthWeekContext?: StrengthWeekContext
}

export type WorkoutVariant = {
  kind: 'FULL' | 'LIGHT' | 'COMPACT_10' | 'COMPACT_20' | 'COMPACT_30'
  /** Käyttäjän enimmäisaika. durationMinutes on käyttäjälle näytettävä laskettu kesto. */
  timeBudgetMinutes?: number
  durationMinutes: number
  volumeMultiplier: number
}

export type ExerciseLoadType =
  | 'EXTERNAL_KG'
  | 'DUMBBELL_KG_EACH'
  | 'MACHINE_KG'
  | 'BAND'
  | 'BODYWEIGHT'
  | 'LEVEL'
  | 'NONE'

export type StrengthSetsDose = {
  kind: 'STRENGTH_SETS'
  sets: number
  repetitions: string
  restSeconds: number
  targetRpe: number
  targetRir?: number
}

export type ContinuousTimeDose = {
  kind: 'CONTINUOUS_TIME'
  durationSeconds: number
  targetRpe: number
  intensityCue: string
}

export type IntervalBlocksDose = {
  kind: 'INTERVAL_BLOCKS'
  repetitions: number
  workSeconds: number
  recoverySeconds: number
  targetRpe: number
  intensityCue: string
}

export type SprintRepsDose = {
  kind: 'SPRINT_REPS'
  repetitions: number
  distanceMeters: number
  recoverySeconds: number
  targetRpe: number
  qualityStopRule: string
}

export type JumpRepsDose = {
  kind: 'JUMP_REPS'
  sets: number
  repetitions: number
  recoverySeconds: number
  targetRpe: number
  qualityStopRule: string
}

export type SkillDrillDose = {
  kind: 'SKILL_DRILL'
  sets: number
  repetitions?: string
  durationSeconds?: number
  recoverySeconds: number
  targetRpe: number
  qualityCue: string
}

export type PrescriptionDose =
  | StrengthSetsDose
  | ContinuousTimeDose
  | IntervalBlocksDose
  | SprintRepsDose
  | JumpRepsDose
  | SkillDrillDose

export type SessionObjective = {
  primary: string
  secondary: string[]
  fatigueBudget: 'LOW' | 'MODERATE' | 'HIGH'
  avoid: string[]
  primaryAdaptation?: string
  secondaryAdaptations?: string[]
  sessionKind?: SessionKind
  durationMinutes?: number
  intensityIntent?: string
  fatigueLimits?: {
    systemic: number
    lowerBody: number
    upperBody: number
    eccentric: number
  }
  requiredMovementPatterns?: string[]
  optionalMovementPatterns?: string[]
  avoidTags?: string[]
  evidenceClaimIds?: string[]
}

export type CapabilityEstimate = {
  exerciseCode: string
  estimated1RmKg?: number
  workingLoadRangeKg?: [number, number]
  confidence: 'LOW' | 'MODERATE' | 'HIGH'
  supportingSetCount: number
  /** Eri tallennettujen harjoituskertojen määrä; sarjojen määrä ei korvaa tätä. */
  supportingSessionCount?: number
  /** Päätöksessä käytetyt pseudonyymit WorkoutRecord-tunnisteet. */
  supportingSessionIds?: string[]
  latestValidSetAt?: string
  calibrationRequired: boolean
  reasons: string[]
}

export type ExerciseProgressionDecision = {
  action:
    | 'RECALIBRATE_LOAD'
    | 'KEEP_LOAD'
    | 'INCREASE_REPETITIONS'
    | 'INCREASE_LOAD'
    | 'INCREASE_SETS'
  /** Viimeisimpien vertailukelpoisten harjoitusten toteutunut kuorma. */
  currentLoadKg?: number
  nextLoadKg?: number
  nextRepetitions?: number
  nextSets?: number
  changedVariable: 'NONE' | 'LOAD' | 'REPETITIONS' | 'SETS'
  reasonCodes: string[]
  /** Eri WorkoutRecord-tunnisteet, joihin progression päätös perustuu. */
  supportingSessionIds: string[]
}

/**
 * Käyttäjän vahvistama todellinen seuraava käytettävissä oleva kuorma.
 *
 * Vahvistus koskee aina yhtä liikeversiota, kuormakontekstia ja nykyistä
 * kuormaa. Näin eri välineiden ja kuorman mukaan muuttuvia portaita ei
 * typistetä yhdeksi pysyväksi increment-arvoksi.
 */
export type VerifiedNextLoad = {
  exerciseCode: string
  exerciseVersion: string
  loadContextId: string
  currentLoadKg: number
  nextAvailableLoadKg: number
  confirmedAt: string
  policyVersion: string
}

export type UnsupportedPrescription = {
  status: 'UNSUPPORTED'
  sessionKind: SessionKind
  reasonCode:
    | 'YOUTH_ENGINE_NOT_AVAILABLE'
    | 'OLDER_ADULT_ENGINE_NOT_AVAILABLE'
    | 'SAFETY_INFORMATION_INCOMPLETE'
    | 'READINESS_RED_STOP'
    | 'READINESS_RECOVERY_ONLY'
    | 'NO_SAFE_STRENGTH_DOSE_AVAILABLE'
    | 'PULL_PATTERN_EQUIPMENT_REQUIRED'
    | 'HEALTH_ENGINE_NOT_AVAILABLE'
    | 'SPEED_POWER_ENGINE_NOT_REVIEWED'
    | 'SPORT_ENGINE_NOT_REVIEWED'
    | 'MATCH_ENGINE_NOT_REVIEWED'
  userMessage: string
}

export type PrescriptionResult =
  { status: 'SUPPORTED'; prescription: PrescribedSession } | UnsupportedPrescription

export type ExercisePrescription = {
  id: string
  code: string
  /** Harjoitteen muuttumaton sisältöversio. */
  contentVersion?: string
  nameFi: string
  category: string
  equipment: string[]
  instructionsFi: string
  sets: number
  repetitions?: string
  durationSeconds?: number
  restSeconds: number
  targetRpe: number
  targetRir?: number
  /** Valinnainen tavoiteväli esimerkiksi tauolta paluun RIR 3–4 -ohjaukseen. */
  targetRirRange?: [number, number]
  /** Liikekohtaiset lämmittely-/kalibrointisarjat ennen työsarjoja. */
  warmupSets?: number
  /** Versionoidun aikamallin käyttämä arvio yhden työsarjan kestosta. */
  estimatedWorkSetSeconds?: number
  loadGuidance: string
  stopCondition: string
  substitutions: string[]
  loadType: ExerciseLoadType
  loadLabelFi: string
  loadOptions?: string[]
  /** @deprecated Legacy-snapshotin lukutuki; uusi tuotantopolku käyttää VerifiedNextLoad-vahvistusta. */
  loadIncrementKg?: number
  /** Versionoitu konteksti, jonka sisällä kilogrammat ovat vertailukelpoisia. */
  loadContextId?: string
  /** Kanoninen liikekohtainen seuraavan harjoituskerran progressiopäätös. */
  progressionDecision?: ExerciseProgressionDecision
  techniqueVideoUrl?: string
  /** Harjoitekirjaston v2-metatiedot; puuttuvat vanhoista snapshot-versioista. */
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  trainingEffects?: string[]
  fatigueCost?: 'LOW' | 'MODERATE' | 'HIGH'
  contraindications?: string[]
  /** Lihasmetatiedot snapshotataan, jotta vanhaa historiaa ei tulkita uudelleen. */
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  techniqueReviewStatus?: 'VERIFIED' | 'PENDING_REVIEW'
  keyExercise: boolean
  /** V2:n yksikäsitteinen annos. Puuttuu vain ennen v2:ta tallennetuista snapshoteista. */
  dose?: PrescriptionDose
}

export type PrescriptionTimeBreakdown = {
  warmupSeconds: number
  exerciseWarmupSeconds: number
  workSeconds: number
  restSeconds: number
  transitionSeconds: number
  equipmentSetupSeconds: number
  cooldownSeconds: number
  bufferSeconds: number
  totalSeconds: number
  policyVersion: string
}

export type PrescribedSession = {
  /** Puuttuva arvo tarkoittaa ennen v2:ta tallennettua legacy-snapshotia. */
  schemaVersion?: 1 | 2
  engineVersion?: string
  id: string
  title: string
  kind: SessionKind
  goal: GoalType
  durationMinutes: number
  timeBudgetMinutes?: number
  calculatedTotalSeconds?: number
  timePolicyVersion?: string
  timeBreakdown?: PrescriptionTimeBreakdown
  timeAdjustmentReasonCodes?: string[]
  /** Paluusovitus voi säilyttää alkuperäisen kanonisen aikapuskurin. */
  minimumTimeBufferSeconds?: number
  objective?: SessionObjective
  confidence?: DecisionTrace['confidence']
  warmup: string[]
  warmupMinutes?: number
  exercises: ExercisePrescription[]
  /** V2-nimi suoritusjärjestyksessä oleville harjoitusblokeille. */
  blocks?: ExercisePrescription[]
  cooldown: string[]
  cooldownMinutes?: number
  progression: string
  decisionTrace: DecisionTrace
}

export type WorkoutCompletionStatus = 'COMPLETED' | 'PARTIAL' | 'STOPPED'

export type WorkoutFeedback = {
  completionStatus: WorkoutCompletionStatus
  sessionRpe: number
  difficulty: 'TOO_EASY' | 'RIGHT' | 'TOO_HARD'
  pain: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'
  painLocation: string
  felt: 'WORSE' | 'SAME' | 'BETTER'
  notes: string
  stopReason?:
    | 'PAIN'
    | 'DIZZINESS'
    | 'BREATHING'
    | 'NEUROLOGICAL'
    | 'TECHNIQUE'
    | 'EQUIPMENT'
    | 'OTHER'
  exerciseResults?: WorkoutExerciseResult[]
}

export type WorkoutExerciseResult = {
  exerciseCode: string
  exerciseVersion?: string
  exerciseName: string
  loadType: ExerciseLoadType
  loadContextId?: string
  /** @deprecated Vanhan historian lukutuki; ei valtuuta uutta kilogrammaprogressiota. */
  loadIncrementKg?: number
  completedSets: number
  plannedSets: number
  completed?: boolean[]
  repetitions: Array<number | null>
  loads: Array<string | null>
  rirs?: Array<number | null>
  painResponses?: Array<SetPainResponse | null>
  techniqueOk?: Array<boolean | null>
  targetRepetitions?: string
  targetRpe: number
  /** Tallennettu prescription-tavoite paluuharjoituksen hyväksyntää varten. */
  targetRirRange?: [number, number]
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
}

export type WorkoutProgressionDecision = {
  action: 'MAINTAIN' | 'PROGRESS_LOAD' | 'REDUCE_LOAD' | 'RECOVERY' | 'REFER'
  safetyOutcome: SafetyOutcome
  setDelta: -1 | 0 | 1
  targetRpeDelta: -1 | 0
  message: string
  ruleId: string
}

export type CompletedSet = {
  exerciseId: string
  setNumber: number
  repetitions: number | null
  loadKg: number | null
  loadText?: string | null
  rir?: number | null
  completed: boolean
  painResponse?: SetPainResponse
  techniqueOk?: boolean
  adaptationReasonCodes?: string[]
}

export type SetPainResponse =
  'NONE' | 'MILD' | 'WORSENING' | 'SHARP' | 'FUNCTION_ALTERING' | 'SEVERE'

export type CompetitionEvent = {
  id: string
  day: number
  name: string
  priority: 'A' | 'B' | 'TRAINING'
  daysUntil: number
}

export type TrainingPlan = {
  goal: GoalType
  sessions: PlannedSession[]
  startingEnduranceMinutes: number
  assessments: string[]
  ruleVersion: string
  strengthWeek?: StrengthWeekPlan
}

export type ReadinessState = 'GREEN' | 'YELLOW' | 'ORANGE_RECOVERY' | 'RED_STOP'
export type SafetySymptom =
  | 'CHEST_PAIN'
  | 'FAINTING'
  | 'UNUSUAL_BREATHLESSNESS'
  | 'NEW_NEUROLOGICAL_SYMPTOM'
  | 'FEVER'
  | 'SIGNIFICANT_DEHYDRATION'
  | 'SEVERE_ACUTE_PAIN'
  | 'JOINT_GIVING_WAY'

export type RelativeLevel = 'LOW' | 'NORMAL' | 'HIGH'
export type ReadinessInput = {
  goal: GoalType
  plannedSession: SessionKind
  safetySymptoms: SafetySymptom[]
  sleep: 'POOR' | 'NORMAL' | 'GOOD'
  energy: RelativeLevel
  stress: RelativeLevel
  motivation: RelativeLevel
  soreness: RelativeLevel
  illnessSymptoms: boolean
  vascularSymptoms?: {
    rapidlyIncreasingUnilateralCalfSwelling: boolean
    painAtRest: boolean
  }
  newPain?: {
    location: string
    severity: 'MILD' | 'MODERATE' | 'SEVERE'
    altersGait: boolean
  }
  availableMinutes: number
  menstrualCycle?: {
    phase: 'MENSTRUATION' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL' | 'UNSURE'
    symptomsImpact: 'NONE' | 'MILD' | 'MODERATE' | 'HIGH'
  }
}

export type ReadinessDecision = {
  state: ReadinessState
  allowedSession: SessionKind
  volumeMultiplier: number
  maximumAttemptsAllowed: boolean
  compactVariantMinutes: 10 | 20 | 30 | null
  goalChanged: false
  action: string
}

export type ProgressionInput = {
  currentWeeklyVolume: number
  adherence: number
  recentReadiness: ReadinessState[]
  missedSession: boolean
  comparablePlateauPeriods: number
  previousChangedVariable: 'VOLUME' | 'INTENSITY' | 'FREQUENCY' | null
}

export type ProgressionDecision = {
  action: 'DELOAD' | 'SIMPLIFY' | 'PROGRESS' | 'MAINTAIN' | 'EVALUATE_PLATEAU'
  nextWeeklyVolume: number
  changedVariable: 'VOLUME' | 'INTENSITY' | 'FREQUENCY' | null
  missedLoadCarriedOver: false
}

export type LowEnergySign =
  | 'MENSTRUAL_CHANGE'
  | 'DECLINING_PERFORMANCE'
  | 'PERSISTENT_FATIGUE_OR_COLD'
  | 'REPEATED_ILLNESS_OR_STRESS_INJURY'
  | 'CONCERNING_EATING_BEHAVIOUR'

export type NutritionInput = {
  goal: GoalType
  weightKg?: number
  reliableWeeklyWeightTrend: number[]
  lowEnergySigns: LowEnergySign[]
  competitionDaysUntil?: number
  desiredChangeKg?: number
  deadlineWeeks?: number
  eatingDisorderHistory?: boolean
}

export type EnergyAction =
  'MAINTAIN' | 'PROPOSE_MODERATE_DEFICIT' | 'PROPOSE_SMALL_SURPLUS' | 'SUSPEND_DEFICIT'

export type NutritionDecision = {
  energyAction: EnergyAction
  requiresUserApproval: boolean
  approved: boolean
  proteinGramsPerKg: WeeklyRange
  usePortionModel: boolean
  deadlineAdjusted: boolean
  fatLossGuidanceActive: boolean
  guidance: string[]
}

export type ProgressPeriod = {
  label: string
  comparable: boolean
  metricValue: number
  dataPoints: number
}

export type ProgressEvaluation = {
  status: 'INSUFFICIENT_DATA' | 'IMPROVING' | 'PLATEAU' | 'DECLINING'
  delta: number | null
}

export type SportDemandProfile = {
  aerobicEndurance: number
  anaerobicCapacity: number
  repeatedSprints: number
  speedAcceleration: number
  changeOfDirection: number
  maximalStrength: number
  explosivePower: number
  jumpThrowAbility: number
  rotation: number
  localMuscularEndurance: number
  mobility: number
  contactImpactLoad: number
}

export type SportAdapter = {
  id: string
  disciplines: string[]
  demandProfile: SportDemandProfile
  keySessions: SessionKind[]
  constraints: string[]
  warning: string | null
}

export type SportAdapterMatch = {
  supportLevel: 'FULL' | 'GENERAL_SUPPORT'
  adapter: SportAdapter
}
