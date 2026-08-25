import { describe, expect, it } from 'vitest'
import type { LocalRecord } from '../../domain/sync/types'
import { buildReminderIcs, isReminderDue, reminderDetails } from './reminderCalendar'

const record = {
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-08-24T10:00:00.000Z',
  data: {
    title: 'Treeni, kevyt; liikkuvuus',
    local_time: '17:30',
    timezone: 'Europe/Helsinki',
    weekdays: [1, 3, 5],
    enabled: true,
  },
} as unknown as LocalRecord

describe('reminder calendar', () => {
  it('creates a timezone-aware recurring ICS file with escaped content', () => {
    const ics = buildReminderIcs(
      reminderDetails(record),
      new Date('2026-08-24T10:00:00.000Z'),
    )
    expect(ics).toContain('DTSTART;TZID=Europe/Helsinki:20260824T173000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR')
    expect(ics).toContain('SUMMARY:Treeni\\, kevyt\\; liikkuvuus')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('shows enabled in-app reminders only during their local due window', () => {
    expect(isReminderDue(record, new Date('2026-08-24T14:45:00Z'))).toBe(true)
    expect(isReminderDue(record, new Date('2026-08-24T16:00:00Z'))).toBe(false)
    expect(isReminderDue(record, new Date('2026-08-25T14:45:00Z'))).toBe(false)
  })

  it('respects a multi-week measurement interval', () => {
    const everySecondWeek = {
      ...record,
      data: { ...record.data, interval_weeks: 2, anchor_date: '2026-08-24' },
    } as unknown as LocalRecord

    expect(isReminderDue(everySecondWeek, new Date('2026-08-24T14:45:00Z'))).toBe(true)
    expect(isReminderDue(everySecondWeek, new Date('2026-08-31T14:45:00Z'))).toBe(false)
    expect(isReminderDue(everySecondWeek, new Date('2026-09-07T14:45:00Z'))).toBe(true)
  })
})
