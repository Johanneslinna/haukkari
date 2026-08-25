import type { LocalRecord } from '../../domain/sync/types'
import {
  booleanValue,
  numberArray,
  numberValue,
  stringValue,
} from '../coaching/coachingData'
import { downloadTextFile } from '../privacy/dataPortability'

const calendarWeekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

export type ReminderDetails = {
  id: string
  title: string
  localTime: string
  timezone: string
  weekdays: number[]
  intervalWeeks: number
  anchorDate: string
  enabled: boolean
}

export function reminderDetails(record: LocalRecord): ReminderDetails {
  return {
    id: record.id,
    title: stringValue(record.data.title, 'Haukkarin muistutus'),
    localTime: stringValue(record.data.local_time, '17:00').slice(0, 5),
    timezone: stringValue(record.data.timezone, 'Europe/Helsinki'),
    weekdays: numberArray(record.data.weekdays).filter((day) => day >= 1 && day <= 7),
    intervalWeeks: Math.max(1, Math.round(numberValue(record.data.interval_weeks, 1))),
    anchorDate: stringValue(
      record.data.anchor_date,
      record.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    ),
    enabled: booleanValue(record.data.enabled, true),
  }
}

export function buildReminderIcs(details: ReminderDetails, now = new Date()) {
  const weekdays = details.weekdays.length ? details.weekdays : [1, 2, 3, 4, 5, 6, 7]
  const localStart = nextLocalOccurrence(
    details.localTime,
    weekdays,
    details.timezone,
    now,
    details.anchorDate,
    details.intervalWeeks,
  )
  const byDay = weekdays.map((day) => calendarWeekdays[day - 1]).join(',')
  const stamp = toUtcCalendarDate(now)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Haukkari//Muistutus//FI',
    'CALSCALE:GREGORIAN',
    `X-WR-TIMEZONE:${escapeIcs(details.timezone)}`,
    'BEGIN:VEVENT',
    `UID:${details.id}@haukkari.fi`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${escapeIcs(details.timezone)}:${localStart}`,
    `RRULE:FREQ=WEEKLY;INTERVAL=${details.intervalWeeks};BYDAY=${byDay}`,
    `SUMMARY:${escapeIcs(details.title)}`,
    'DESCRIPTION:Haukkarin sovelluksen sisäinen muistutus.',
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Haukkarin muistutus',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function downloadReminderIcs(record: LocalRecord) {
  const details = reminderDetails(record)
  downloadTextFile(
    `haukkari-muistutus-${record.id}.ics`,
    buildReminderIcs(details),
    'text/calendar;charset=utf-8',
  )
}

export function isReminderDue(record: LocalRecord, now = new Date()) {
  const details = reminderDetails(record)
  if (!details.enabled) return false
  const local = localParts(now, details.timezone)
  if (!local) return false
  const [hour = 0, minute = 0] = details.localTime.split(':').map(Number)
  const dueMinutes = hour * 60 + minute
  const currentMinutes = local.hour * 60 + local.minute
  if (
    details.weekdays.includes(local.weekday) &&
    intervalMatches(details.anchorDate, details.timezone, now, details.intervalWeeks)
  ) {
    const elapsed = currentMinutes - dueMinutes
    if (elapsed >= 0 && elapsed < 60) return true
  }
  const previousWeekday = local.weekday === 1 ? 7 : local.weekday - 1
  const overnightElapsed = currentMinutes + 1440 - dueMinutes
  return (
    details.weekdays.includes(previousWeekday) &&
    intervalMatches(
      details.anchorDate,
      details.timezone,
      new Date(now.getTime() - 86_400_000),
      details.intervalWeeks,
    ) &&
    dueMinutes >= 1380 &&
    overnightElapsed >= 0 &&
    overnightElapsed < 60
  )
}

function intervalMatches(
  anchorDate: string,
  timezone: string,
  candidate: Date,
  intervalWeeks: number,
) {
  if (intervalWeeks <= 1) return true
  const candidateParts = localParts(candidate, timezone)
  const anchor = new Date(`${anchorDate.slice(0, 10)}T12:00:00Z`)
  const anchorParts = localParts(anchor, timezone)
  if (!candidateParts || !anchorParts) return true
  const candidateSerial = Date.UTC(
    Number(candidateParts.year),
    Number(candidateParts.month) - 1,
    Number(candidateParts.day),
  )
  const anchorSerial = Date.UTC(
    Number(anchorParts.year),
    Number(anchorParts.month) - 1,
    Number(anchorParts.day),
  )
  const candidateWeekStart = candidateSerial - (candidateParts.weekday - 1) * 86_400_000
  const anchorWeekStart = anchorSerial - (anchorParts.weekday - 1) * 86_400_000
  const elapsedWeeks = Math.floor((candidateWeekStart - anchorWeekStart) / 604_800_000)
  return elapsedWeeks >= 0 && elapsedWeeks % intervalWeeks === 0
}

function nextLocalOccurrence(
  localTime: string,
  weekdays: number[],
  timezone: string,
  now: Date,
  anchorDate: string,
  intervalWeeks: number,
) {
  const [hour = 0, minute = 0] = localTime.split(':').map(Number)
  for (let offset = 0; offset < intervalWeeks * 7 + 8; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000)
    const local = localParts(candidate, timezone)
    if (!local || !weekdays.includes(local.weekday)) continue
    if (!intervalMatches(anchorDate, timezone, candidate, intervalWeeks)) continue
    const targetMinutes = hour * 60 + minute
    const currentMinutes = local.hour * 60 + local.minute
    if (offset === 0 && targetMinutes < currentMinutes) continue
    return `${local.year}${local.month}${local.day}T${localTime.replace(':', '')}00`
  }
  throw new Error('Muistutukselle ei löytynyt seuraavaa kalenteriaikaa.')
}

function toUtcCalendarDate(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'Z')
}

function localParts(value: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(value)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? ''
    return {
      year: part('year'),
      month: part('month'),
      day: part('day'),
      hour: Number(part('hour')),
      minute: Number(part('minute')),
      weekday:
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(part('weekday')) + 1,
    }
  } catch {
    return null
  }
}

function escapeIcs(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}
