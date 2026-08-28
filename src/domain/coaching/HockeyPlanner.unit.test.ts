import { describe, expect, it } from 'vitest'
import { plannerEventToSession } from './PlannerEvent'
import { getSportAdapter } from './SportAdapterRegistry'
import { applyHockeyMicrocycle } from './sports/iceHockeyAdapter'
import type { PlannedSession } from './types'

function session(
  id: string,
  day: number,
  patch: Partial<PlannedSession> = {},
): PlannedSession {
  return {
    id,
    day,
    kind: 'STRENGTH',
    durationMinutes: 45,
    intensity: 'HARD',
    loadRegion: 'LOWER',
    fixed: false,
    source: 'APP',
    ...patch,
  }
}

describe('PlannerEvent ja jääkiekon suljettu beta', () => {
  it('normalisoi toistuvan jääharjoituksen kiinteäksi PlannerEvent-istunnoksi', () => {
    const planned = plannerEventToSession(
      {
        id: 'ice-1',
        kind: 'ICE_PRACTICE',
        title: 'Jääharjoitus',
        startsAt: '2026-08-26T18:00:00+03:00',
        durationMinutes: 75,
        intensity: 'HARD',
        fixed: true,
        recurrence: { frequency: 'WEEKLY', interval: 1 },
        metadata: {},
      },
      'Europe/Helsinki',
    )
    expect(planned?.kind).toBe('SPORT')
    expect(planned?.fixed).toBe(true)
    expect(planned?.notes).toContain('Toistuva viikkotapahtuma')
  })

  it('pitää jääkiekkoadapterin pois yleisestä käytöstä ilman beta-lippua', () => {
    expect(getSportAdapter('ice-hockey-adult-amateur-skater').supportLevel).toBe(
      'GENERAL_SUPPORT',
    )
    expect(
      getSportAdapter('ice-hockey-adult-amateur-skater', { hockeyBeta: true }).adapter.id,
    ).toBe('ICE_HOCKEY_ADULT_AMATEUR_SKATER_BETA')
  })

  it('poistaa ottelupäivän kovan oheisen ja muuttaa MD−1/MD+1:n palauttavaksi', () => {
    const result = applyHockeyMicrocycle([
      session('day-before', 3),
      session('same-day', 4),
      session('match', 4, {
        kind: 'MATCH',
        fixed: true,
        source: 'COMPETITION',
        loadRegion: 'FULL_BODY',
      }),
      session('day-after', 5),
      session('team-practice', 5, {
        kind: 'SPORT',
        fixed: true,
        source: 'SPORT',
      }),
    ])
    expect(result.sessions.map((item) => item.id)).not.toContain('same-day')
    expect(result.sessions.find((item) => item.id === 'day-before')?.kind).toBe(
      'RECOVERY',
    )
    expect(result.sessions.find((item) => item.id === 'day-after')?.kind).toBe('RECOVERY')
    expect(result.sessions.find((item) => item.id === 'team-practice')?.kind).toBe(
      'SPORT',
    )
  })
})
