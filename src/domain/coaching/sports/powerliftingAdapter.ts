import type { SportAdapter } from '../types'

export const powerliftingAdapter: SportAdapter = {
  id: 'POWERLIFTING',
  disciplines: [
    'powerlifting-squat',
    'powerlifting-bench-press',
    'powerlifting-deadlift',
    'powerlifting-competition',
  ],
  demandProfile: {
    aerobicEndurance: 1,
    anaerobicCapacity: 2,
    repeatedSprints: 1,
    speedAcceleration: 1,
    changeOfDirection: 1,
    maximalStrength: 5,
    explosivePower: 3,
    jumpThrowAbility: 1,
    rotation: 2,
    localMuscularEndurance: 3,
    mobility: 3,
    contactImpactLoad: 3,
  },
  keySessions: ['STRENGTH'],
  constraints: [
    'Kyykyn, penkkipunnerruksen ja maastavedon harjoituskuorma yhdistetään kokonaisuudeksi.',
    'Kilpailupäivä on A-tapahtuma, eikä sen lähelle lisätä uutta raskasta ärsykettä.',
    'Aloittelijalle käytetään submaksimaalisia sarjoja ja e1RM-arviota yhden toiston testin sijaan.',
  ],
  warning: null,
}
