import type { SportAdapter } from '../types'

export const cyclingAdapter: SportAdapter = {
  id: 'CYCLING',
  disciplines: ['road-cycling', 'gravel-cycling', 'mountain-biking'],
  demandProfile: {
    aerobicEndurance: 5,
    anaerobicCapacity: 3,
    repeatedSprints: 3,
    speedAcceleration: 2,
    changeOfDirection: 2,
    maximalStrength: 2,
    explosivePower: 2,
    jumpThrowAbility: 1,
    rotation: 1,
    localMuscularEndurance: 5,
    mobility: 2,
    contactImpactLoad: 2,
  },
  keySessions: ['EASY_ENDURANCE', 'INTERVAL', 'STRENGTH'],
  constraints: [
    'Maantie-, gravel- ja maastopyöräilyn lajiharjoitukset lasketaan kokonaiskuormaan.',
    'Kova lajiharjoitus voi korvata erillisen intervallin.',
    'Maastopyöräilyssä huomioidaan tekninen ja iskukuormitus.',
  ],
  warning: null,
}
