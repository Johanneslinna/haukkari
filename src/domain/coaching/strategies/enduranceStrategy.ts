import { defineGoalStrategy } from './strategyHelpers'

export const enduranceStrategy = defineGoalStrategy({
  id: 'ENDURANCE',
  label: 'Kestävyyden kasvattaminen',
  requiredInputs: ['nykyinen viikkomäärä', 'lajitausta', 'kilpailumatka'],
  weeklyStructure: {
    EASY_ENDURANCE: { min: 2, max: 4 },
    INTERVAL: { min: 1, max: 2 },
    STRENGTH: { min: 2, max: 2 },
  },
  keyWorkouts: ['EASY_ENDURANCE', 'INTERVAL'],
  progression: [
    'Aloita nykyisestä viikkomäärästä.',
    'Älä nosta määrää ja tehoa samalla viikolla.',
  ],
  deload: ['Säilytä helpon harjoittelun osuus suurena myös kevennyksessä.'],
  nutrition: {
    energyFocus: 'PERFORMANCE_FUELING',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Kohdenna hiilihydraatteja kuormittavien harjoitusten ympärille.'],
  },
  metrics: ['viikkomäärä', 'helpon ja kovan harjoittelun suhde', 'lajitesti'],
  conflictRules: ['MARATHON_PEAK_VS_MAX_STRENGTH_PEAK', 'LARGE_DEFICIT_VS_COMPETITION'],
})
