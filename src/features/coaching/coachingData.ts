import type { JsonObject, JsonValue, LocalRecord } from '../../domain/sync/types'
import type {
  GoalType,
  PlannedSession,
  ReadinessState,
} from '../../domain/coaching/types'

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

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
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
