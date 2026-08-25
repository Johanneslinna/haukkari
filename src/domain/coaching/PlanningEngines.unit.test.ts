import { describe, expect, it, vi } from 'vitest'
import { generatePlan } from './PlanGenerator'
import { optimizeSchedule } from './ScheduleOptimizer'
import { getSportAdapter, listFullySupportedDisciplines } from './SportAdapterRegistry'
import { generalSportSupportWarning } from './sports/generalSportSupportAdapter'
import type { PlannedSession } from './types'

function appInterval(): PlannedSession {
  return {
    id: 'app-interval',
    day: 6,
    kind: 'INTERVAL',
    durationMinutes: 30,
    intensity: 'HARD',
    loadRegion: 'LOWER',
    fixed: false,
    source: 'APP',
    isNewStimulus: true,
  }
}

function fixedSport(
  id: string,
  day: number,
  intensity: PlannedSession['intensity'] = 'MODERATE',
) {
  return {
    id,
    day,
    kind: 'SPORT' as const,
    durationMinutes: 60,
    intensity,
    loadRegion: 'FULL_BODY' as const,
    fixed: true,
    source: 'SPORT' as const,
  }
}

describe('PlanGenerator, ScheduleOptimizer ja lajisovittimet', () => {
  it('21: kestävyystavoite lähtee täsmälleen nykyisestä viikkomäärästä', () => {
    const result = generatePlan({
      goal: { primary: 'ENDURANCE', secondary: [], inputs: {} },
      experience: 'INTERMEDIATE',
      availableDays: [1, 2, 3, 5, 7],
      currentEnduranceMinutes: 180,
      fixedSessions: [],
      competitions: [],
    })
    const enduranceMinutes = result.decision.sessions
      .filter(
        (session) => session.kind === 'EASY_ENDURANCE' || session.kind === 'INTERVAL',
      )
      .reduce((total, session) => total + session.durationMinutes, 0)
    expect(result.decision.startingEnduranceMinutes).toBe(180)
    expect(enduranceMinutes).toBe(180)
  })

  it('ei ylitä 90 minuutin rajaa eikä muodosta 267 minuutin harjoitusta', () => {
    const result = generatePlan({
      goal: { primary: 'ENDURANCE', secondary: [], inputs: {} },
      experience: 'INTERMEDIATE',
      availableDays: [2],
      currentEnduranceMinutes: 267,
      fixedSessions: [],
      competitions: [],
      minutesPerSession: 90,
      minutesByDay: { '2': 90 },
    })
    const generated = result.decision.sessions.filter(
      (session) => session.source === 'APP',
    )

    expect(generated).toHaveLength(1)
    expect(generated[0]?.durationMinutes).toBe(90)
    expect(
      generated[0]?.variants?.every((variant) => variant.durationMinutes <= 90),
    ).toBe(true)
    expect(result.reasons.map((reason) => reason.code)).toContain(
      'ENDURANCE_VOLUME_CAPPED_BY_AVAILABLE_TIME',
    )
  })

  it('laskee rakenteisen nykyisen juoksuharjoituksen viikkovolyymiin vain kerran', () => {
    const fixedRun: PlannedSession = {
      id: 'fixed-run',
      day: 2,
      kind: 'EASY_ENDURANCE',
      title: 'Säännöllinen juoksu',
      durationMinutes: 60,
      intensity: 'EASY',
      loadRegion: 'CARDIO',
      fixed: true,
      source: 'SPORT',
    }
    const result = generatePlan({
      goal: { primary: 'ENDURANCE', secondary: [], inputs: {} },
      experience: 'INTERMEDIATE',
      availableDays: [1, 3, 5, 7],
      currentEnduranceMinutes: 180,
      fixedSessions: [fixedRun],
      competitions: [],
      minutesPerSession: 90,
    })
    const enduranceMinutes = result.decision.sessions
      .filter(
        (session) => session.kind === 'EASY_ENDURANCE' || session.kind === 'INTERVAL',
      )
      .reduce((total, session) => total + session.durationMinutes, 0)

    expect(enduranceMinutes).toBe(180)
  })

  it('22: aloittelijan voimatavoite ei sisällä yhden toiston maksimitestiä', () => {
    const result = generatePlan({
      goal: { primary: 'MAX_STRENGTH', secondary: [], inputs: {} },
      experience: 'BEGINNER',
      availableDays: [1, 3, 5],
      currentEnduranceMinutes: 0,
      fixedSessions: [],
      competitions: [],
    })
    expect(result.decision.assessments).toEqual([
      'Submaksimaalinen tekniikka- ja toistotesti',
      'e1RM-arvio sarjasta',
    ])
    expect(result.reasons.map((reason) => reason.code)).toContain(
      'NO_BEGINNER_ONE_REP_MAX_TEST',
    )
  })

  it('23: kolme lajiharjoitusta ja ottelu poistavat ylimääräisen intervallin', () => {
    const result = optimizeSchedule({
      sessions: [
        fixedSport('sport-1', 1),
        fixedSport('sport-2', 3),
        fixedSport('sport-3', 5),
        { ...fixedSport('match', 7, 'HARD'), kind: 'MATCH', source: 'COMPETITION' },
        appInterval(),
      ],
      competitions: [],
    })
    expect(result.decision.some((session) => session.id === 'app-interval')).toBe(false)
    expect(result.reasons.map((reason) => reason.code)).toContain(
      'SPORT_LOAD_REPLACES_INTERVAL',
    )
  })

  it('24: lähellä A-kilpailua ei lisätä raskasta uutta ärsykettä', () => {
    const result = optimizeSchedule({
      sessions: [appInterval(), fixedSport('coach-session', 2, 'HARD')],
      competitions: [
        { id: 'race', day: 7, name: 'A-kilpailu', priority: 'A', daysUntil: 6 },
      ],
    })
    expect(result.decision.map((session) => session.id)).not.toContain('app-interval')
    expect(result.decision.map((session) => session.id)).toContain('coach-session')
  })

  it('25: tuntematon laji antaa vain yleisen lajituen ja täsmällisen varoituksen', () => {
    const match = getSportAdapter('salibandy')
    expect(match.supportLevel).toBe('GENERAL_SUPPORT')
    expect(match.adapter.id).toBe('GENERAL_SPORT_SUPPORT')
    expect(match.adapter.warning).toBe(generalSportSupportWarning)
  })

  it('29: väliin jäänyt harjoitus poistuu ilman kuorman tuplaamista', () => {
    const first = { ...appInterval(), id: 'missed', durationMinutes: 40 }
    const second = { ...appInterval(), id: 'kept', day: 7, durationMinutes: 40 }
    const result = optimizeSchedule({
      sessions: [first, second],
      competitions: [],
      missedSessionId: 'missed',
    })
    expect(result.decision).toHaveLength(1)
    expect(result.decision[0]?.durationMinutes).toBe(40)
  })

  it('erottaa sovelluksen suuren jalkakuorman kiinteästä kuormasta sallitulle päivälle', () => {
    const movable: PlannedSession = {
      ...appInterval(),
      id: 'movable',
      day: 1,
      kind: 'STRENGTH',
    }
    const fixed = { ...fixedSport('fixed', 2, 'HARD'), loadRegion: 'LOWER' as const }
    const result = optimizeSchedule({
      sessions: [movable, fixed],
      competitions: [],
      allowedDays: [1, 2, 4],
    })
    expect(result.decision.find((session) => session.id === 'movable')?.day).toBe(4)
    expect(result.reasons.map((reason) => reason.code)).toContain(
      'SEPARATE_MAJOR_LOWER_LOADS',
    )
  })

  it('luo jokaiselle sovelluksen harjoitukselle täyden, kevennetyn ja kompaktit versiot', () => {
    const result = generatePlan({
      goal: { primary: 'GENERAL_FITNESS', secondary: [], inputs: {} },
      experience: 'BEGINNER',
      availableDays: [1, 2, 4, 6],
      currentEnduranceMinutes: 0,
      fixedSessions: [],
      competitions: [],
    })
    const generated = result.decision.sessions.filter(
      (session) => session.source === 'APP',
    )
    expect(generated.length).toBeGreaterThan(0)
    for (const session of generated) {
      expect(session.variants?.map((variant) => variant.kind)).toEqual([
        'FULL',
        'LIGHT',
        'COMPACT_10',
        'COMPACT_20',
        'COMPACT_30',
      ])
    }
  })

  it('ei kasaa useita sovelluksen harjoituksia samalle päivälle, jos päiviä on liian vähän', () => {
    const result = generatePlan({
      goal: { primary: 'GENERAL_FITNESS', secondary: [], inputs: {} },
      experience: 'BEGINNER',
      availableDays: [2],
      currentEnduranceMinutes: 0,
      fixedSessions: [],
      competitions: [],
    })

    expect(
      result.decision.sessions.filter((session) => session.source === 'APP'),
    ).toHaveLength(1)
    expect(result.reasons.map((reason) => reason.code)).toContain(
      'PLAN_FITS_AVAILABLE_DAYS',
    )
  })

  it('sisältää täydet sovittimet kaikille briefissä luetelluille alalajeille', () => {
    expect(listFullySupportedDisciplines()).toEqual(
      expect.arrayContaining([
        'running-5k',
        'running-10k',
        'running-half-marathon',
        'running-marathon',
        'trail-running',
        'road-cycling',
        'gravel-cycling',
        'mountain-biking',
        'powerlifting-squat',
        'powerlifting-bench-press',
        'powerlifting-deadlift',
        'powerlifting-competition',
      ]),
    )
    expect(getSportAdapter('running-marathon').supportLevel).toBe('FULL')
    expect(getSportAdapter('powerlifting-competition').supportLevel).toBe('FULL')
  })

  it('jääkiekkobetan lippu ei muuta tavallisen liikkujan tai juoksijan ohjelmaa', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00.000Z'))
    const generalInput = {
      goal: { primary: 'GENERAL_FITNESS' as const, secondary: [], inputs: {} },
      experience: 'BEGINNER' as const,
      availableDays: [1, 3, 5],
      currentEnduranceMinutes: 60,
      fixedSessions: [],
      competitions: [],
    }
    const runningInput = {
      ...generalInput,
      goal: { primary: 'ENDURANCE' as const, secondary: [], inputs: {} },
      experience: 'INTERMEDIATE' as const,
      sportDiscipline: 'running-10k',
      currentEnduranceMinutes: 120,
    }

    try {
      expect(
        generatePlan({ ...generalInput, hockeyBeta: true }).decision.sessions,
      ).toEqual(generatePlan({ ...generalInput, hockeyBeta: false }).decision.sessions)
      expect(
        generatePlan({ ...runningInput, hockeyBeta: true }).decision.sessions,
      ).toEqual(generatePlan({ ...runningInput, hockeyBeta: false }).decision.sessions)
    } finally {
      vi.useRealTimers()
    }
  })
})
