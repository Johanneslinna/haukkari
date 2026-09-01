import {
  isVerifiedNextLoadContext,
  type ExercisePrescription,
} from '../../domain/coaching'

export function requestsNextLoadConfirmation(exercise: ExercisePrescription) {
  return (
    exercise.progressionDecision?.action === 'KEEP_LOAD' &&
    exercise.progressionDecision.reasonCodes.includes(
      'NEXT_AVAILABLE_LOAD_NOT_CONFIRMED',
    ) &&
    exercise.progressionDecision.currentLoadKg !== undefined &&
    exercise.contentVersion !== undefined &&
    exercise.loadContextId !== undefined &&
    isVerifiedNextLoadContext(exercise.loadType, exercise.loadContextId) &&
    (exercise.loadType === 'EXTERNAL_KG' ||
      exercise.loadType === 'DUMBBELL_KG_EACH' ||
      exercise.loadType === 'MACHINE_KG')
  )
}

export function mayPrefillPreviousLoad(exercise: ExercisePrescription) {
  return !exercise.progressionDecision?.reasonCodes.some((code) =>
    [
      'PREVIOUS_LOAD_REFERENCE_ONLY',
      'OLD_LOAD_REFERENCE_ONLY',
      'OLD_LOAD_HISTORY_DISPLAY_ONLY',
      'PRE_BREAK_LOAD_AUTHORITY_REVOKED',
    ].includes(code),
  )
}
