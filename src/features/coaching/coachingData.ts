import type { JsonObject, JsonValue, LocalRecord } from '../../domain/sync/types'
import type {
  GoalType,
  PlannedSession,
  PrescribedSession,
  ReadinessState,
  StrengthWeekPlan,
} from '../../domain/coaching/types'
import {
  createLocalCalendarContext,
  LEGACY_CALENDAR_TIME_ZONE,
  localCalendarDate,
  validateCalendarTimeZone,
} from '../../domain/coaching/LocalCalendarPolicy'

export const goalLabels: Record<GoalType, string> = {
  BODY_RECOMPOSITION: 'Yleiskunto ja kehonkoostumus',
  FAT_LOSS: 'Maltillinen rasvanpudotus',
  MUSCLE_GAIN: 'Lihasmassan kasvattaminen',
  MAX_STRENGTH: 'Maksimivoima',
  ENDURANCE: 'Kestävyys',
  SPEED_POWER: 'Nopeus ja räjähtävä voima',
  GENERAL_FITNESS: 'Yleinen terveys ja toimintakyky',
  POSTURE_MOBILITY: 'Ryhti, liikkuvuus ja kehonhallinta',
  SPORT_PERFORMANCE: 'Lajikohtainen suorituskyky',
}

export const sessionLabels: Record<PlannedSession['kind'], string> = {
  STRENGTH: 'Voimaharjoitus',
  EASY_ENDURANCE: 'Helppo kestävyys',
  INTERVAL: 'Intervallit',
  SPEED_POWER: 'Nopeus ja teho',
  MOBILITY: 'Liikkuvuus ja hallinta',
  SPORT: 'Lajiharjoitus',
  MATCH: 'Ottelu tai kilpailu',
  RECOVERY: 'Palauttava liike',
  REST: 'Lepo',
}

export const readinessLabels: Record<ReadinessState, string> = {
  GREEN: 'Vihreä – suunnitelman mukaan',
  YELLOW: 'Keltainen – kevennä määrää',
  ORANGE_RECOVERY: 'Oranssi – palaudu',
  RED_STOP: 'Punainen – älä harjoittele',
}

export function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

export function objectValue(value: JsonValue | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

export function stringValue(value: JsonValue | undefined, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export function numberValue(value: JsonValue | undefined, fallback = 0) {
  return typeof value === 'number' ? value : fallback
}

export function booleanValue(value: JsonValue | undefined, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

export function arrayValue(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : []
}

export function numberArray(value: JsonValue | undefined) {
  return arrayValue(value).filter((item): item is number => typeof item === 'number')
}

export function latestByDate(records: LocalRecord[], field: string) {
  return [...records].sort((left, right) =>
    stringValue(right.data[field], right.updatedAt).localeCompare(
      stringValue(left.data[field], left.updatedAt),
    ),
  )
}

export function calendarTimeZoneFromProfile(profile: LocalRecord | null) {
  const appSettings = objectValue(profile?.data.app_settings)
  const configured = stringValue(appSettings.calendarTimeZone)
  const legacyProfileTimeZone = stringValue(profile?.data.timezone)
  const selected = configured || legacyProfileTimeZone || LEGACY_CALENDAR_TIME_ZONE
  return validateCalendarTimeZone(selected)
}

export function calendarContextForProfile(
  profile: LocalRecord | null,
  at: Date | string = new Date(),
) {
  return createLocalCalendarContext(at, calendarTimeZoneFromProfile(profile))
}

export function todayIso(
  timeZone = LEGACY_CALENDAR_TIME_ZONE,
  at: Date | string = new Date(),
) {
  return localCalendarDate(at, timeZone)
}

export function fiDate(value: string) {
  return new Intl.DateTimeFormat('fi-FI', { dateStyle: 'medium' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  )
}

export function planSessions(plan: JsonObject | null): PlannedSession[] {
  if (!plan || !Array.isArray(plan.sessions)) return []
  return plan.sessions.filter(
    (value): value is JsonObject =>
      value !== null && typeof value === 'object' && !Array.isArray(value),
  ) as unknown as PlannedSession[]
}

export function sessionTotalDurationMinutes(session: PlannedSession) {
  const calculatedSeconds =
    session.prescriptionDetail?.timeBreakdown?.totalSeconds ??
    session.prescriptionDetail?.calculatedTotalSeconds
  return typeof calculatedSeconds === 'number' && calculatedSeconds > 0
    ? Math.ceil(calculatedSeconds / 60)
    : session.durationMinutes
}

export function prescriptionTimeBreakdownItems(prescription: PrescribedSession) {
  const breakdown = prescription.timeBreakdown
  if (!breakdown) return []
  return [
    { label: 'Yleislämmittely', seconds: breakdown.warmupSeconds },
    {
      label: 'Liikekohtaiset lämmittelysarjat',
      seconds: breakdown.exerciseWarmupSeconds,
    },
    { label: 'Työsarjat', seconds: breakdown.workSeconds },
    { label: 'Sarjapalautukset', seconds: breakdown.restSeconds },
    {
      label: 'Liikkeiden vaihdot ja välineiden säädöt',
      seconds: breakdown.transitionSeconds + breakdown.equipmentSetupSeconds,
    },
    { label: 'Loppuverryttely', seconds: breakdown.cooldownSeconds },
    { label: 'Aikapuskuri', seconds: breakdown.bufferSeconds },
  ].filter((item) => item.seconds > 0)
}

export function formatEstimatedSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} s`
  const minutes = seconds / 60
  return Number.isInteger(minutes)
    ? `${minutes} min`
    : `${minutes.toLocaleString('fi-FI', { maximumFractionDigits: 1 })} min`
}

function strengthRoleReason(role: string | undefined) {
  if (role?.startsWith('UPPER')) {
    return 'Tämä on viikon ylävartaloharjoitus. Se täydentää ala- ja ylävartalopäivistä muodostuvaa nelijakoista viikkoa.'
  }
  if (role?.startsWith('LOWER')) {
    return 'Tämä on viikon alavartaloharjoitus. Se täydentää ala- ja ylävartalopäivistä muodostuvaa nelijakoista viikkoa.'
  }
  if (role?.startsWith('FULL_BODY')) {
    return 'Tämä on koko kehon harjoitus. Se täydentää viikon muita voimaharjoituksia ilman saman harjoituksen tarpeetonta toistamista.'
  }
  return ''
}

function userFacingRuleMessage(message: string) {
  if (
    message === 'Annostus pysyy julkaistun aikuisten voimaharjoittelusäännön sisällä.'
  ) {
    return 'Liikkeet ja sarjamäärät on sovitettu viikon turvalliseen kokonaiskuormaan.'
  }
  if (message === 'Kuorma kalibroidaan ilman näennäisen tarkkaa kilogrammamäärää.') {
    return 'Ensimmäinen harjoitus auttaa löytämään sopivat kuormat hallitulla kalibroinnilla.'
  }
  return message
}

export function prescriptionDecisionReasons(prescription: PrescribedSession) {
  const roleReason = strengthRoleReason(prescription.decisionTrace.strengthWeek?.role)
  const structureReason = prescription.strengthRoleStructure?.messageFi ?? ''
  const ruleReasons = prescription.decisionTrace.rules
    .filter((rule) => rule.ruleId !== 'FEEDBACK-NONE-001')
    .map((rule) => userFacingRuleMessage(rule.message.trim()))
  return [
    roleReason,
    structureReason,
    ...ruleReasons,
    prescription.progression.trim(),
  ].filter(
    (reason, index, reasons) => reason.length > 0 && reasons.indexOf(reason) === index,
  )
}

export function planStrengthWeek(plan: JsonObject | null): StrengthWeekPlan | null {
  if (!plan || !plan.strengthWeek || typeof plan.strengthWeek !== 'object') return null
  const value = plan.strengthWeek as JsonObject
  if (
    typeof value.policyVersion !== 'string' ||
    typeof value.weekAnchorDate !== 'string' ||
    typeof value.targetSessions !== 'number' ||
    !Array.isArray(value.reasonCodes)
  ) {
    return null
  }
  return value as unknown as StrengthWeekPlan
}
