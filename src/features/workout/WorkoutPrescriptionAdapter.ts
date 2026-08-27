import {
  ADULT_STRENGTH_TIME_POLICY_VERSION,
  adaptPrescription,
  evaluatePrescriptionAdaptationSafety,
  strengthSafetyGateMessage,
  type ConfirmedLimitationTag,
  type PrescribedSession,
  type PrescriptionAdaptationSafetyContext,
  type PrescriptionResult,
  type ReadinessState,
  type WorkoutVariant,
} from '../../domain/coaching'
import type { LocalRecord } from '../../domain/sync/types'
import { objectValue, stringValue, todayIso } from '../coaching/coachingData'

const readinessStates = new Set<ReadinessState>([
  'GREEN',
  'YELLOW',
  'ORANGE_RECOVERY',
  'RED_STOP',
])

const confirmedLimitationTagValues = new Set<ConfirmedLimitationTag>([
  'ACUTE_KNEE_PAIN',
  'ACUTE_BACK_PAIN',
  'ACUTE_SHOULDER_PAIN',
  'ACUTE_WRIST_PAIN',
  'GAIT_ALTERING_PAIN',
  'OVERHEAD_RESTRICTION',
  'ACHILLES_PAIN',
  'CALF_INJURY',
  'HAMSTRING_INJURY',
])

export function confirmedLimitationTags(value: unknown): ConfirmedLimitationTag[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ConfirmedLimitationTag =>
          typeof item === 'string' &&
          confirmedLimitationTagValues.has(item as ConfirmedLimitationTag),
      )
    : []
}

export function storedReadiness(value: unknown): ReadinessState | undefined {
  return typeof value === 'string' && readinessStates.has(value as ReadinessState)
    ? (value as ReadinessState)
    : undefined
}

export function ageFromBirthDate(value: unknown, today = todayIso()) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(today)
  ) {
    return undefined
  }
  const years = Number(today.slice(0, 4)) - Number(value.slice(0, 4))
  const birthdayPassed = today.slice(5) >= value.slice(5)
  const age = years - (birthdayPassed ? 0 : 1)
  return Number.isInteger(age) && age >= 0 ? age : undefined
}

export function currentWorkoutSafetyContext(input: {
  profile: LocalRecord | null
  screening: LocalRecord | null
  readiness: unknown
  today?: string
}): PrescriptionAdaptationSafetyContext {
  const screeningStatus = stringValue(input.screening?.data.status)
  const healthBlocked =
    screeningStatus === 'HIGH_INTENSITY_BLOCKED' || screeningStatus === 'NEEDS_REVIEW'
      ? true
      : screeningStatus === 'CLEAR'
        ? false
        : undefined
  const answers = objectValue(input.screening?.data.answers)
  const hasLegacyLimitationText = [
    stringValue(answers.current_injuries_surgeries_and_mobility_limits),
    stringValue(answers.doctor_restrictions),
  ].some((value) => value.trim().length > 0)
  const hasConfirmedLimitation =
    confirmedLimitationTags(answers.confirmed_limitation_tags).length > 0

  return {
    age: ageFromBirthDate(input.profile?.data.birth_date, input.today),
    readiness: storedReadiness(input.readiness),
    healthBlocked,
    safetyInformationComplete:
      typeof healthBlocked === 'boolean' &&
      (!hasLegacyLimitationText || hasConfirmedLimitation),
  }
}

/**
 * Käyttöliittymän ainoa prescriptionin mukautusreitti. Turvallisuustiedot
 * luetaan nykyisistä käyttäjätietueista, ei tallennetusta prescriptionista.
 */
export function adaptWorkoutPrescriptionForCurrentAthlete(input: {
  prescription: PrescribedSession
  variant: WorkoutVariant
  profile: LocalRecord | null
  screening: LocalRecord | null
  readiness: unknown
  today?: string
}): PrescriptionResult {
  return adaptPrescription(
    input.prescription,
    input.variant,
    currentWorkoutSafetyContext(input),
  )
}

/** Portittaa jatkettavan snapshotin muuttamatta sen kirjattua rakennetta. */
export function authorizeWorkoutPrescriptionForCurrentAthlete(input: {
  prescription: PrescribedSession
  profile: LocalRecord | null
  screening: LocalRecord | null
  readiness: unknown
  today?: string
}): PrescriptionResult {
  const safetyContext = currentWorkoutSafetyContext(input)
  const gate = evaluatePrescriptionAdaptationSafety(input.prescription, safetyContext)
  if (gate.allowed) {
    if (
      input.prescription.kind === 'STRENGTH' &&
      (input.prescription.timePolicyVersion !== ADULT_STRENGTH_TIME_POLICY_VERSION ||
        !input.prescription.timeBreakdown)
    ) {
      const timeBudgetMinutes =
        input.prescription.timeBudgetMinutes ?? input.prescription.durationMinutes
      return adaptPrescription(
        input.prescription,
        {
          kind: 'FULL',
          timeBudgetMinutes,
          durationMinutes: timeBudgetMinutes,
          volumeMultiplier: 1,
        },
        safetyContext,
      )
    }
    return { status: 'SUPPORTED', prescription: input.prescription }
  }
  return {
    status: 'UNSUPPORTED',
    sessionKind: input.prescription.kind,
    reasonCode: gate.reasonCode,
    userMessage: strengthSafetyGateMessage(gate.reasonCode),
  }
}
