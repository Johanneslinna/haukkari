import { defineGoalStrategy } from './strategyHelpers'

export const speedPowerStrategy = defineGoalStrategy({
  id: 'SPEED_POWER',
  label: 'Nopeuden ja räjähtävän voiman kasvattaminen',
  requiredInputs: ['nopeus- tai teholaji', 'harjoittelutausta', 'vammahistoria'],
  weeklyStructure: {
    SPEED_POWER: { min: 2, max: 3 },
    STRENGTH: { min: 2, max: 3 },
  },
  keyWorkouts: ['SPEED_POWER', 'STRENGTH'],
  progression: [
    'Pidä palautukset pitkinä.',
    'Lopeta ennen tekniikan tai suorituskyvyn selvää hajoamista.',
  ],
  deload: ['Vähennä toistoja, mutta säilytä laadukas suoritus.'],
  nutrition: {
    energyFocus: 'ADEQUATE_ENERGY',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Väsymys ei saa olla nopeusharjoittelun tavoite.'],
  },
  metrics: ['suorituksen laatu', 'nopeus tai hyppytulos', 'palautuminen'],
  conflictRules: ['SPEED_WHILE_FATIGUED'],
})
