import type { PlannedSession, SportAdapter } from '../types'

export type HockeySeasonPhase =
  | 'OFF_SEASON'
  | 'PRE_SEASON'
  | 'IN_SEASON'
  | 'CONGESTED'
  | 'TRANSITION'

export const iceHockeyAdapter: SportAdapter = {
  id: 'ICE_HOCKEY_ADULT_AMATEUR_SKATER_BETA',
  disciplines: ['ice-hockey-adult-amateur-skater'],
  demandProfile: {
    aerobicEndurance: 4,
    anaerobicCapacity: 5,
    repeatedSprints: 5,
    speedAcceleration: 5,
    changeOfDirection: 5,
    maximalStrength: 4,
    explosivePower: 5,
    jumpThrowAbility: 3,
    rotation: 4,
    localMuscularEndurance: 4,
    mobility: 3,
    contactImpactLoad: 5,
  },
  keySessions: ['SPORT', 'MATCH', 'STRENGTH', 'SPEED_POWER', 'RECOVERY'],
  constraints: [
    'Ottelupäivälle ei lisätä kovaa oheisharjoitusta.',
    'Ottelua edeltävä ja seuraava päivä pidetään palauttavana.',
    'Raskasta alavartalovolyymia ei sijoiteta ottelun välittömään läheisyyteen.',
    'Kiinteää joukkueharjoitusta ei siirretä.',
  ],
  warning:
    'Suljettu beta on rajattu 18 vuotta täyttäneille amatöörikenttäpelaajille. Maalivahti- ja juniorilogiikka eivät sisälly tähän versioon.',
}

export function applyHockeyMicrocycle(
  sessions: PlannedSession[],
): { sessions: PlannedSession[]; messages: string[] } {
  const matchDays = sessions
    .filter((session) => session.kind === 'MATCH')
    .map((session) => session.day)
  const messages: string[] = []
  const adjusted = sessions.flatMap((session) => {
    if (session.fixed || session.source !== 'APP') return [session]
    const distance = matchDays.length
      ? Math.min(...matchDays.map((day) => Math.abs(day - session.day)))
      : Infinity
    if (matchDays.includes(session.day) && session.intensity === 'HARD') {
      messages.push('Ottelupäivän kova oheisharjoitus poistettiin.')
      return []
    }
    if (distance === 1 && session.intensity !== 'EASY') {
      messages.push('Ottelua edeltävä tai seuraava harjoitus muutettiin palauttavaksi.')
      return [{
        ...session,
        kind: 'RECOVERY' as const,
        title: 'Ottelun ympäristön palauttava harjoitus',
        durationMinutes: Math.min(20, session.durationMinutes),
        intensity: 'EASY' as const,
        loadRegion: 'NONE' as const,
        notes: [...(session.notes ?? []), 'Jääkiekon beta: MD−1/MD+1 palauttava.'],
      }]
    }
    return [session]
  })
  return { sessions: adjusted, messages }
}
