import { defineGoalStrategy } from './strategyHelpers'

export const postureMobilityStrategy = defineGoalStrategy({
  id: 'POSTURE_MOBILITY',
  label: 'Ryhti, liikkuvuus ja kehonhallinta',
  requiredInputs: ['koetut rajoitteet', 'liikemieltymykset'],
  weeklyStructure: {
    STRENGTH: { min: 2, max: 3 },
    MOBILITY: { min: 4, max: 7 },
  },
  keyWorkouts: ['STRENGTH', 'MOBILITY'],
  progression: ['Tee 5–10 minuutin kohdennettu harjoitus useana päivänä.'],
  deload: ['Vähennä ärsyttäviä liikkeitä ja säilytä kivuton liike.'],
  nutrition: {
    energyFocus: 'MAINTENANCE',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Tavoite ei edellytä energiansaannin muuttamista.'],
  },
  metrics: [
    'liikkeen hallinta',
    'käyttäjän kokema toimintakyky',
    'harjoittelun säännöllisyys',
  ],
  conflictRules: [],
})
