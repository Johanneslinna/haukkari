import { describe, expect, it } from 'vitest'
import {
  createLocalCalendarContext,
  localCalendarDate,
  mondayWeekAnchor,
  weekdayInTimeZone,
} from './LocalCalendarPolicy'

describe('local-calendar-1.0.0', () => {
  it.each([
    ['2026-08-30T20:30:00.000Z', '2026-08-30', '2026-08-24', 7],
    ['2026-08-30T21:30:00.000Z', '2026-08-31', '2026-08-31', 1],
    ['2026-08-31T00:30:00.000Z', '2026-08-31', '2026-08-31', 1],
  ])(
    'laskee Helsingin sunnuntai–maanantai-rajan hetkelle %s',
    (instant, date, anchor, weekday) => {
      expect(localCalendarDate(instant, 'Europe/Helsinki')).toBe(date)
      expect(mondayWeekAnchor(date)).toBe(anchor)
      expect(weekdayInTimeZone(instant, 'Europe/Helsinki')).toBe(weekday)
    },
  )

  it.each([
    ['2026-03-29T00:30:00.000Z', '2026-03-29'],
    ['2026-03-29T01:30:00.000Z', '2026-03-29'],
    ['2026-10-25T00:30:00.000Z', '2026-10-25'],
    ['2026-10-25T01:30:00.000Z', '2026-10-25'],
  ])('säilyttää paikallisen päivän DST-rajalla %s', (instant, expected) => {
    expect(localCalendarDate(instant, 'Europe/Helsinki')).toBe(expected)
  })

  it('tuottaa yhdestä hetkestä yhtenäisen eksplisiittisen kalenterikontekstin', () => {
    expect(
      createLocalCalendarContext('2026-08-30T21:30:00.000Z', 'Europe/Helsinki'),
    ).toEqual({
      policyVersion: 'local-calendar-1.0.0',
      generatedAt: '2026-08-30T21:30:00.000Z',
      calendarTimeZone: 'Europe/Helsinki',
      localDate: '2026-08-31',
      weekAnchorDate: '2026-08-31',
      weekday: 1,
    })
  })

  it.each([
    ['', 'INVALID_CALENDAR_TIME_ZONE'],
    ['Not/A_Timezone', 'INVALID_CALENDAR_TIME_ZONE'],
  ])('estää virheellisen aikavyöhykkeen %s', (timeZone, reason) => {
    expect(() => localCalendarDate(new Date(), timeZone)).toThrow(reason)
  })

  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])(
    'estää virheellisen paikallisen päivän %s',
    (value) =>
      expect(() => mondayWeekAnchor(value)).toThrow('INVALID_LOCAL_CALENDAR_DATE'),
  )
})
