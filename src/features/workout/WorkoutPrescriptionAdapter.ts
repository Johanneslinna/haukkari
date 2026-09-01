import {
  ADULT_STRENGTH_TIME_POLICY_VERSION,
  SEVERE_DOMS_STRENGTH_REASON_CODE,
  adaptPrescription,
  evaluatePrescriptionAdaptationSafety,
  strengthSafetyGateMessage,
  type ConfirmedLimitationTag,
  type PrescribedSession,
  type PrescriptionAdaptationProgressContext,
  type PrescriptionAdaptationSafetyContext,
  type PrescriptionResult,
  type ReadinessState,
  type UnsupportedPrescription,
  type WorkoutVariant,
} from '../../domain/coaching'
import type { LocalRecord } from '../../domain/sync/types'
import { objectValue, stringValue, todayIso } from '../coaching/coachingData'
import { hasMeaningfulRestrictionText } from '../coaching/healthInformation'

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

/**
 * Päivän kuntotarkistus tallentaa tarkistushetken harjoitustyypin. Jos
 * viikkosuunnitelmaa muokataan myöhemmin, vanha tyyppi ei saa estää uuden
 * suunnitelman harjoituksen avaamista. Kuntotarkistuksen tekemä varsinainen
 * turvallisuusmuutos (esimerkiksi palauttava harjoitus tai lepo) säilytetään.
 */
export function effectiveSessionKindForCurrentPlan(input: {
  currentSessionKind: PrescribedSession['kind']
  checkedSessionKind: PrescribedSession['kind']
  allowedSessionKind: PrescribedSession['kind']
}): PrescribedSession['kind'] {
  const checkInOnlyMirrorsOldPlan =
    input.checkedSessionKind !== input.currentSessionKind &&
    input.allowedSessionKind === input.checkedSessionKind

  return checkInOnlyMirrorsOldPlan ? input.currentSessionKind : input.allowedSessionKind
}

const currentSafetyReasonCodes = new Set<UnsupportedPrescription['reasonCode']>([
  'HEALTH_ENGINE_NOT_AVAILABLE',
  'SAFETY_INFORMATION_INCOMPLETE',
  'YOUTH_ENGINE_NOT_AVAILABLE',
  'OLDER_ADULT_ENGINE_NOT_AVAILABLE',
  'READINESS_RED_STOP',
  'READINESS_RECOVERY_ONLY',
])

/** Tallennettu turvallisuusesto arvioidaan uudelleen päivän nykyisillä tiedoilla. */
export function shouldReevaluateStoredSafetyReasonCode(reasonCode: string) {
  return currentSafetyReasonCodes.has(reasonCode as UnsupportedPrescription['reasonCode'])
}

export function shouldReevaluateStoredSafetyBlock(prescription: UnsupportedPrescription) {
  return shouldReevaluateStoredSafetyReasonCode(prescription.reasonCode)
}

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
  readinessReasonCodes?: unknown
  today?: string
}): PrescriptionAdaptationSafetyContext {
  const screeningStatus = stringValue(input.screening?.data.status)
  const completedWithoutSensitiveHealthData =
    input.screening === null && input.profile?.data.onboarding_completed === true
  const healthBlocked =
    screeningStatus === 'HIGH_INTENSITY_BLOCKED' || screeningStatus === 'NEEDS_REVIEW'
      ? true
      : screeningStatus === 'CLEAR'
        ? false
        : completedWithoutSensitiveHealthData
          ? false
          : undefined
  const answers = objectValue(input.screening?.data.answers)
  const hasLegacyLimitationText = [
    stringValue(answers.current_injuries_surgeries_and_mobility_limits),
    stringValue(answers.doctor_restrictions),
  ].some(hasMeaningfulRestrictionText)
  const hasConfirmedLimitation =
    confirmedLimitationTags(answers.confirmed_limitation_tags).length > 0

  return {
    age: ageFromBirthDate(input.profile?.data.birth_date, input.today),
    readiness: storedReadiness(input.readiness),
    healthBlocked,
    safetyInformationComplete:
      typeof healthBlocked === 'boolean' &&
      (!hasLegacyLimitationText || hasConfirmedLimitation),
    ...(input.readinessReasonCodes === undefined
      ? {}
      : {
          readinessReasonCodes: Array.isArray(input.readinessReasonCodes)
            ? input.readinessReasonCodes.filter(
                (value): value is string => typeof value === 'string',
              )
            : [],
        }),
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
  readinessReasonCodes?: unknown
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
  readinessReasonCodes?: unknown
  completedUnitsByExerciseId?: PrescriptionAdaptationProgressContext['completedUnitsByExerciseId']
  today?: string
}): PrescriptionResult {
  const safetyContext = currentWorkoutSafetyContext(input)
  const gate = evaluatePrescriptionAdaptationSafety(input.prescription, safetyContext)
  if (gate.allowed) {
    const severeDomsAdaptationRequired =
      input.prescription.kind === 'STRENGTH' &&
      safetyContext.readiness === 'YELLOW' &&
      safetyContext.readinessReasonCodes?.includes(SEVERE_DOMS_STRENGTH_REASON_CODE) ===
        true &&
      !input.prescription.decisionTrace.rules.some(
        (rule) => rule.ruleId === 'READINESS-SEVERE-DOMS-001',
      )
    if (
      severeDomsAdaptationRequired ||
      (input.prescription.kind === 'STRENGTH' &&
        (input.prescription.timePolicyVersion !== ADULT_STRENGTH_TIME_POLICY_VERSION ||
          !input.prescription.timeBreakdown))
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
        { completedUnitsByExerciseId: input.completedUnitsByExerciseId },
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
