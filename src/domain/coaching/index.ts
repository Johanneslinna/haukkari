export { evaluateGoalConflicts } from './ConflictEngine'
export { CapabilityEstimator, estimateExerciseCapability } from './CapabilityEstimator'
export type { ExerciseCapabilityEstimate } from './CapabilityEstimator'
export {
  AdultResistanceEngine,
  ADULT_RESISTANCE_ENGINE_VERSION,
  ADULT_RESISTANCE_LOAD_CONTEXT_VERSION,
  ADULT_RESISTANCE_RULE_VERSION,
  adaptNextSet,
  createResistanceSessionObjective,
  decideInterSessionProgression,
  defaultResistanceLoadContextId,
  estimateAdultResistanceCapability,
  filterEligibleExercises,
  nextAutomaticLoadKg,
  prescribeAdultResistanceSession,
  prescribeResistanceDose,
  scoreExerciseCandidates,
} from './AdultResistanceEngine'
export type {
  AdultResistanceAthleteContext,
  AdultResistanceSetHistory,
  EligibilityDecision,
  ExerciseCandidateScore,
  InterSessionProgressionDecision,
  ResistanceDoseDecision,
  SetAdaptationAction,
  SetAdaptationDecision,
} from './AdultResistanceEngine'
export {
  InMemoryExerciseCatalog,
  TRAINING_CONTENT_RELEASE,
  publishedExerciseCatalog,
} from './content/TrainingContent'
export type {
  EvidenceClaim,
  EvidenceSource,
  ExerciseCatalog,
  ExerciseDefinition,
  PrescriptionRule,
} from './content/TrainingContent'
export {
  exerciseAllowedForExperience,
  exerciseConflictsWithLimitations,
  exerciseLibrary,
  verifiedTechniqueUrl,
} from './ExerciseLibrary'
export type {
  ExerciseDifficulty,
  ExerciseFatigueCost,
  ExerciseTemplate,
  TechniqueReviewStatus,
} from './ExerciseLibrary'
export {
  PlannerEventModel,
  plannerEventToSession,
  plannerEventWeekday,
} from './PlannerEvent'
export type { PlannerEvent, PlannerEventKind } from './PlannerEvent'
export { applyHockeyMicrocycle, iceHockeyAdapter } from './sports/iceHockeyAdapter'
export type { HockeySeasonPhase } from './sports/iceHockeyAdapter'
export * from './engine'
export {
  GoalEngine,
  confirmGoalChange,
  previewGoalChange,
  previewPreviousGoalRestore,
} from './GoalEngine'
export {
  NutritionPolicyEngine,
  approveEnergyProposal,
  evaluateNutritionPolicy,
} from './NutritionPolicyEngine'
export { PlanGenerator, generatePlan } from './PlanGenerator'
export { ProgressEvaluator, evaluateProgress } from './ProgressEvaluator'
export { ProgressionEngine, evaluateProgression } from './ProgressionEngine'
export {
  PRESCRIPTION_ENGINE_VERSION,
  PRESCRIPTION_SCHEMA_VERSION,
  doseDurationSeconds,
  doseLabelFi,
  doseUnitCount,
  legacyDose,
  normalizePrescriptionV2,
  prescriptionBlocks,
  prescriptionDurationSeconds,
  withV2Blocks,
  withExerciseDose,
} from './PrescriptionContract'
export { ReadinessEngine, evaluateReadiness } from './ReadinessEngine'
export {
  evaluateStrengthSafetyGate,
  strengthSafetyGateMessage,
} from './StrengthSafetyGate'
export type {
  StrengthSafetyGateDecision,
  StrengthSafetyGateInput,
  StrengthSafetyGateReasonCode,
} from './StrengthSafetyGate'
export { ScheduleOptimizer, optimizeSchedule } from './ScheduleOptimizer'
export {
  MAX_ROLLING_MUSCLE_SETS,
  MAX_SESSION_PRIMARY_MUSCLE_SETS,
  PRIMARY_MUSCLE_SET_WEIGHT,
  SECONDARY_MUSCLE_SET_WEIGHT,
  STRENGTH_VOLUME_POLICY_VERSION,
  addPlannedSets,
  calculateRollingMuscleVolume,
  maximumAdditionalSets,
} from './StrengthVolumePolicy'
export type { MuscleVolume, VersionedStrengthSet } from './StrengthVolumePolicy'
export {
  ADULT_STRENGTH_TIME_POLICY,
  ADULT_STRENGTH_TIME_POLICY_VERSION,
  STRENGTH_TIME_REASON_CODES,
  STRENGTH_TIME_INVARIANT_CODES,
  auditStrengthPrescriptionTime,
  estimatePrescriptionTime,
  fitStrengthPrescriptionToTimeBudget,
  refreshStrengthPrescriptionTimeEstimate,
} from './TimeBudgetPolicy'
export type { StrengthTimeBudgetPolicy, StrengthTimeFitResult } from './TimeBudgetPolicy'
export {
  SportAdapterRegistry,
  getSportAdapter,
  listFullySupportedDisciplines,
} from './SportAdapterRegistry'
export { getGoalStrategy, goalStrategies } from './strategies'
export {
  TrainingPrescriptionEngine,
  adaptPrescription,
  evaluatePrescriptionAdaptationSafety,
  exerciseSubstitutions,
  prescribeSession,
  resolvePrescription,
  TRAINING_RULE_VERSION,
} from './TrainingPrescriptionEngine'
export type {
  PrescriptionAdaptationSafetyContext,
  PrescriptionProfile,
} from './TrainingPrescriptionEngine'
export {
  WorkoutFeedbackEngine,
  applyWorkoutProgression,
  evaluateWorkoutFeedback,
} from './WorkoutFeedbackEngine'
export type * from './types'
