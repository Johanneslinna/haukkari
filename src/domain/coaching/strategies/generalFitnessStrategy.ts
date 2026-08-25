import { defineGoalStrategy } from './strategyHelpers'

export const generalFitnessStrategy = defineGoalStrategy({
  id: 'GENERAL_FITNESS',
  label: 'Yleinen terveys ja toimintakyky',
  requiredInputs: ['nykyinen liikunta', 'käytettävissä oleva aika'],
  weeklyStructure: {
    STRENGTH: { min: 2, max: 3 },
    EASY_ENDURANCE: { min: 2, max: 4 },
  },
  keyWorkouts: ['STRENGTH', 'EASY_ENDURANCE'],
  progression: ['Suosi toteutettavuutta ja säännöllisyyttä.'],
  deload: ['Yksinkertaista viikkoa, jos toteuma jää alle 70 %:n.'],
  nutrition: {
    energyFocus: 'MAINTENANCE',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Säännölliset ateriat ja riittävä energiansaanti.'],
  },
  metrics: ['toteutuminen', 'toimintakyky', 'koettu jaksaminen'],
  conflictRules: [],
})
