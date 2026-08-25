export { evaluateGoalConflicts } from './ConflictEngine'
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
