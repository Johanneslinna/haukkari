import type { SportAdapter } from '../types'

export const runningAdapter: SportAdapter = {
  id: 'RUNNING',
  disciplines: [
    'running-5k',
    'running-10k',
    'running-half-marathon',
    'running-marathon',
    'trail-running',
  ],
  demandProfile: {
    aerobicEndurance: 5,
    anaerobicCapacity: 3,
    repeatedSprints: 1,
    speedAcceleration: 2,
    changeOfDirection: 1,
    maximalStrength: 2,
    explosivePower: 2,
    jumpThrowAbility: 1,
    rotation: 1,
    localMuscularEndurance: 5,
    mobility: 2,
    contactImpactLoad: 3,
  },
  keySessions: ['EASY_ENDURANCE', 'INTERVAL', 'STRENGTH'],
  constraints: [
    'Ohjelma alkaa nykyisestä juoksumäärästä.',
    'Määrää ja tehoa ei nosteta samalla viikolla.',
    'Polkujuoksussa huomioidaan alustan ja alamäkien iskukuormitus.',
  ],
  warning: null,
}
