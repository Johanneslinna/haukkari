import type { SportAdapter } from '../types'

export const generalSportSupportWarning =
  'Tämä on yleinen lajia tukeva fysiikkaohjelma. Se ei korvaa lajitekniikan, taktiikan tai valmentajan ohjausta.'

export const generalSportSupportAdapter: SportAdapter = {
  id: 'GENERAL_SPORT_SUPPORT',
  disciplines: [],
  demandProfile: {
    aerobicEndurance: 2,
    anaerobicCapacity: 2,
    repeatedSprints: 2,
    speedAcceleration: 2,
    changeOfDirection: 2,
    maximalStrength: 2,
    explosivePower: 2,
    jumpThrowAbility: 2,
    rotation: 2,
    localMuscularEndurance: 2,
    mobility: 2,
    contactImpactLoad: 2,
  },
  keySessions: ['STRENGTH', 'EASY_ENDURANCE'],
  constraints: [
    'Kiinteät lajiharjoitukset lasketaan kokonaiskuormaan.',
    'Sovellus ei anna lajitekniikan tai taktiikan ohjeita.',
  ],
  warning: generalSportSupportWarning,
}
