export { evaluateGoalConflicts } from './ConflictEngine'
export {
  CapabilityEstimator,
  estimateExerciseCapability,
} from './CapabilityEstimator'
export type { ExerciseCapabilityEstimate } from './CapabilityEstimator'
export { PlannerEventModel, plannerEventToSession, plannerEventWeekday } from './PlannerEvent'
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
export { ScheduleOptimizer, optimizeSchedule } from './ScheduleOptimizer'
export {
  SportAdapterRegistry,
  getSportAdapter,
  listFullySupportedDisciplines,
} from './SportAdapterRegistry'
export { getGoalStrategy, goalStrategies } from './strategies'
export {
  TrainingPrescriptionEngine,
  adaptPrescription,
  exerciseSubstitutions,
  prescribeSession,
  TRAINING_RULE_VERSION,
} from './TrainingPrescriptionEngine'
export {
  WorkoutFeedbackEngine,
  applyWorkoutProgression,
  evaluateWorkoutFeedback,
} from './WorkoutFeedbackEngine'
export type * from './types'
