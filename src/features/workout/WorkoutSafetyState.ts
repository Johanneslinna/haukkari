import type { SafetyOutcome } from '../../domain/coaching'

export function isLockedSafetyOutcome(outcome: SafetyOutcome) {
  return outcome === 'STOP' || outcome === 'REFER'
}

export function canResumeWorkout(sessionLockReason: string | null) {
  return sessionLockReason === null
}
