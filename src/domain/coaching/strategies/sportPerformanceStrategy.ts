import { defineGoalStrategy } from './strategyHelpers'

export const sportPerformanceStrategy = defineGoalStrategy({
  id: 'SPORT_PERFORMANCE',
  label: 'Lajikohtainen suorituskyky',
  requiredInputs: [
    'laji ja alalaji',
    'lajiharjoitusten ajat ja kuormitus',
    'kilpailukalenteri',
    'valmentajan rajoitteet',
  ],
  weeklyStructure: { SPORT: { min: 1, max: 7 } },
  keyWorkouts: ['SPORT'],
  progression: ['Lajiharjoitukset, ottelut ja kilpailut lasketaan kokonaiskuormaan.'],
  deload: [
    'Kilpailukalenteri ja valmentajan ohjelma ohittavat sovelluksen lisäharjoitteet.',
  ],
  nutrition: {
    energyFocus: 'PERFORMANCE_FUELING',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Hiilihydraatit ja palautuminen korostuvat kuormittavina lajipäivinä.'],
  },
  metrics: ['lajitesti', 'kilpailutulos', 'lajiharjoitusten kokonaiskuorma'],
  conflictRules: ['LARGE_DEFICIT_VS_COMPETITION', 'TWO_A_EVENTS'],
})
