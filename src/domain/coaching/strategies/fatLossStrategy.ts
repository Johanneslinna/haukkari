import { defineGoalStrategy } from './strategyHelpers'

export const fatLossStrategy = defineGoalStrategy({
  id: 'FAT_LOSS',
  label: 'Rasvan ja painon maltillinen vähentäminen',
  requiredInputs: ['painotrendi', 'energiansaannin seurantatapa', 'tavoiteaika'],
  weeklyStructure: {
    STRENGTH: { min: 2, max: 3 },
    EASY_ENDURANCE: { min: 2, max: 4 },
  },
  keyWorkouts: ['STRENGTH', 'EASY_ENDURANCE'],
  progression: [
    'Suhteuta arkiaktiivisuus omaan perustasoon.',
    'Suojaa voimatasot ja palautuminen.',
  ],
  deload: ['Älä korvaa ruokavaliota valtavalla aerobisella määrällä.'],
  nutrition: {
    energyFocus: 'APPROVED_MODERATE_DEFICIT',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Energiavaje otetaan käyttöön vain käyttäjän hyväksynnällä.'],
  },
  metrics: ['vähintään kolmen viikon painotrendi', 'voimatasot', 'palautuminen'],
  conflictRules: [
    'FAT_LOSS_VS_MAXIMAL_MUSCLE_GAIN',
    'LARGE_DEFICIT_VS_COMPETITION',
    'WEIGHT_LOSS_VS_LOW_ENERGY',
  ],
})
