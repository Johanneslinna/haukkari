import type {
  CompetitionEvent,
  ExplainableDecision,
  PlannedSession,
  SessionKind,
} from './types'

export type ScheduleOptimizationInput = {
  sessions: PlannedSession[]
  competitions: CompetitionEvent[]
  missedSessionId?: string
  allowedDays?: number[]
}

function isMajorLowerLoad(session: PlannedSession) {
  return (
    session.intensity === 'HARD' &&
    (session.loadRegion === 'LOWER' || session.loadRegion === 'FULL_BODY')
  )
}

function firstSafeDay(
  session: PlannedSession,
  sessions: PlannedSession[],
  allowedDays: number[],
) {
  for (const day of allowedDays) {
    const occupied = sessions.some(
      (candidate) => candidate.id !== session.id && candidate.day === day,
    )
    const adjacentMajorLoad = sessions.some(
      (candidate) =>
        candidate.id !== session.id &&
        isMajorLowerLoad(candidate) &&
        Math.abs(candidate.day - day) <= 1,
    )
    if (!occupied && !adjacentMajorLoad) return day
  }
  return null
}

function removeFirstAppSession(sessions: PlannedSession[], kind: SessionKind) {
  const index = sessions.findIndex(
    (session) => session.kind === kind && session.source === 'APP',
  )
  if (index < 0) return false
  sessions.splice(index, 1)
  return true
}

export function optimizeSchedule(
  input: ScheduleOptimizationInput,
): ExplainableDecision<PlannedSession[]> {
  let sessions = input.sessions.map((session) => ({
    ...session,
    notes: [...(session.notes ?? [])],
  }))
  const reasons: ExplainableDecision<PlannedSession[]>['reasons'] = []
  const warnings: string[] = []

  if (input.missedSessionId) {
    const previousLength = sessions.length
    sessions = sessions.filter((session) => session.id !== input.missedSessionId)
    if (sessions.length !== previousLength) {
      reasons.push({
        code: 'MISSED_SESSION_NOT_DOUBLED',
        message:
          'Väliin jäänyt harjoitus poistettiin viikosta eikä sen kuormaa lisätty toiselle päivälle.',
        priority: 'RECOVERY',
      })
    }
  }

  const fixedSportSessions = sessions.filter(
    (session) => session.fixed && session.kind === 'SPORT',
  )
  const matches = sessions.filter((session) => session.kind === 'MATCH')
  if (fixedSportSessions.length >= 3 && matches.length >= 1) {
    if (removeFirstAppSession(sessions, 'INTERVAL')) {
      reasons.push({
        code: 'SPORT_LOAD_REPLACES_INTERVAL',
        message:
          'Kolme lajiharjoitusta ja ottelu korvaavat sovelluksen ylimääräisen intervallin.',
        priority: 'COACH_FIXED',
      })
    }
  } else if (
    fixedSportSessions.some((session) => session.intensity === 'HARD') &&
    removeFirstAppSession(sessions, 'INTERVAL')
  ) {
    reasons.push({
      code: 'HARD_SPORT_REPLACES_INTERVAL',
      message:
        'Kova lajiharjoitus laskettiin laatuharjoitukseksi ja se korvasi erillisen intervallin.',
      priority: 'COACH_FIXED',
    })
  }

  const nearACompetition = input.competitions.some(
    (competition) =>
      competition.priority === 'A' &&
      competition.daysUntil >= 0 &&
      competition.daysUntil <= 10,
  )
  if (nearACompetition) {
    const removed = sessions.filter(
      (session) =>
        session.source === 'APP' && session.isNewStimulus && session.intensity === 'HARD',
    )
    if (removed.length > 0) {
      const removedIds = new Set(removed.map((session) => session.id))
      sessions = sessions.filter((session) => !removedIds.has(session.id))
      reasons.push({
        code: 'NO_NEW_HEAVY_STIMULUS_NEAR_A_EVENT',
        message: 'A-kilpailun lähellä ei lisätä uutta raskasta harjoitusärsykettä.',
        priority: 'COACH_FIXED',
      })
    }
  }

  sessions.sort((left, right) => left.day - right.day || left.id.localeCompare(right.id))
  for (let index = 1; index < sessions.length; index += 1) {
    const previous = sessions[index - 1]
    const current = sessions[index]
    if (
      previous &&
      current &&
      isMajorLowerLoad(previous) &&
      isMajorLowerLoad(current) &&
      current.day - previous.day <= 1
    ) {
      const movable = !current.fixed ? current : !previous.fixed ? previous : null
      if (movable) {
        const safeDay = firstSafeDay(
          movable,
          sessions,
          input.allowedDays ?? [1, 2, 3, 4, 5, 6, 7],
        )
        if (safeDay !== null) {
          movable.day = safeDay
          movable.notes?.push('Siirretty erilleen edellisestä suuresta jalkakuormasta.')
          reasons.push({
            code: 'SEPARATE_MAJOR_LOWER_LOADS',
            message:
              'Kaksi suurta jalkakuormaa erotettiin toisistaan palautumisen suojaamiseksi.',
            priority: 'RECOVERY',
          })
          sessions.sort(
            (left, right) => left.day - right.day || left.id.localeCompare(right.id),
          )
        } else {
          warnings.push(
            'Kahta suurta jalkakuormaa ei voitu erottaa käyttäjän käytettävissä oleville päiville.',
          )
        }
      } else {
        warnings.push(
          'Valmentajan tai lajin kiinteät suuret jalkakuormat ovat peräkkäin; sovellus ei siirtänyt niitä.',
        )
      }
    }
  }

  return { decision: sessions, reasons, warnings }
}

export const ScheduleOptimizer = { optimize: optimizeSchedule }
