export const LOCAL_CALENDAR_POLICY_VERSION = 'local-calendar-1.0.0'
export const LEGACY_CALENDAR_TIME_ZONE = 'Europe/Helsinki'

const ISO_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u

function validInstant(at: Date | string) {
  const value = at instanceof Date ? new Date(at.getTime()) : new Date(at)
  if (!Number.isFinite(value.getTime())) throw new Error('INVALID_CALENDAR_INSTANT')
  return value
}

export function validateCalendarTimeZone(timeZone: string) {
  if (!timeZone.trim()) throw new Error('INVALID_CALENDAR_TIME_ZONE')
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(0))
  } catch {
    throw new Error('INVALID_CALENDAR_TIME_ZONE')
  }
  return timeZone
}

function dateParts(at: Date | string, timeZone: string) {
  const instant = validInstant(at)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: validateCalendarTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  }
}

function dateTimeParts(at: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: validateCalendarTimeZone(timeZone),
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return Object.fromEntries(
    formatter
      .formatToParts(at)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

function calendarDateParts(localDate: string) {
  if (!ISO_LOCAL_DATE.test(localDate)) throw new Error('INVALID_LOCAL_CALENDAR_DATE')
  const [year, month, day] = localDate.split('-').map(Number)
  const calendarDate = new Date(Date.UTC(year!, month! - 1, day!))
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month! - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new Error('INVALID_LOCAL_CALENDAR_DATE')
  }
  return { year: year!, month: month!, day: day!, calendarDate }
}

function isoFromUtcCalendarDate(value: Date) {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function localCalendarDate(at: Date | string, timeZone: string) {
  const { year, month, day } = dateParts(at, timeZone)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}`
}

export function weekdayForLocalDate(localDate: string) {
  const { calendarDate } = calendarDateParts(localDate)
  return calendarDate.getUTCDay() || 7
}

export function weekdayInTimeZone(at: Date | string, timeZone: string) {
  return weekdayForLocalDate(localCalendarDate(at, timeZone))
}

export function mondayWeekAnchor(localDate: string) {
  const { calendarDate } = calendarDateParts(localDate)
  const weekday = calendarDate.getUTCDay() || 7
  calendarDate.setUTCDate(calendarDate.getUTCDate() - (weekday - 1))
  return isoFromUtcCalendarDate(calendarDate)
}

/** Muuntaa yksiselitteisen paikallisen päiväajan UTC-hetkeksi ilman palvelimen TZ-oletusta. */
export function instantForLocalDateTime(localDate: string, timeZone: string, hour = 12) {
  const { year, month, day } = calendarDateParts(localDate)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23)
    throw new Error('INVALID_LOCAL_CALENDAR_TIME')
  const targetWallClock = Date.UTC(year, month - 1, day, hour, 0, 0)
  let candidate = new Date(targetWallClock)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = dateTimeParts(candidate, timeZone)
    const actualWallClock = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    )
    candidate = new Date(candidate.getTime() + targetWallClock - actualWallClock)
  }
  const resolved = dateTimeParts(candidate, timeZone)
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour
  ) {
    throw new Error('UNRESOLVABLE_LOCAL_CALENDAR_TIME')
  }
  return candidate
}

export type LocalCalendarContext = {
  policyVersion: typeof LOCAL_CALENDAR_POLICY_VERSION
  generatedAt: string
  calendarTimeZone: string
  localDate: string
  weekAnchorDate: string
  weekday: number
}

export function createLocalCalendarContext(
  at: Date | string,
  calendarTimeZone: string,
): LocalCalendarContext {
  const instant = validInstant(at)
  const timeZone = validateCalendarTimeZone(calendarTimeZone)
  const localDate = localCalendarDate(instant, timeZone)
  return {
    policyVersion: LOCAL_CALENDAR_POLICY_VERSION,
    generatedAt: instant.toISOString(),
    calendarTimeZone: timeZone,
    localDate,
    weekAnchorDate: mondayWeekAnchor(localDate),
    weekday: weekdayForLocalDate(localDate),
  }
}
