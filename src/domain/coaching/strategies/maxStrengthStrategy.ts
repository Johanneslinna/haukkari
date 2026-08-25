import { defineGoalStrategy } from './strategyHelpers'

export const maxStrengthStrategy = defineGoalStrategy({
  id: 'MAX_STRENGTH',
  label: 'Maksimivoiman kasvattaminen',
  requiredInputs: ['voimaharjoittelutausta', 'pääliikkeet', 'submaksimaaliset tulokset'],
  weeklyStructure: { STRENGTH: { min: 3, max: 4 } },
  keyWorkouts: ['STRENGTH'],
  progression: [
    'Harjoittele pääliikkeitä pääosin 2–6 toiston submaksimaalisilla sarjoilla.',
    'Seuraa e1RM-kehitystä ilman pakollisia yhden toiston maksimitestejä.',
  ],
  deload: ['Laske määrää ennen raskaan harjoittelun jatkamista.'],
  nutrition: {
    energyFocus: 'ADEQUATE_ENERGY',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Riittävä energiansaanti tukee suorituskykyä.'],
  },
  metrics: ['e1RM', 'sarjojen nopeus tai koettu kuormitus', 'tekniikan laatu'],
  conflictRules: ['MARATHON_PEAK_VS_MAX_STRENGTH_PEAK'],
})
