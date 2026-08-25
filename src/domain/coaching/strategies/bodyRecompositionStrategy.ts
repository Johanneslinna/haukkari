import { defineGoalStrategy } from './strategyHelpers'

export const bodyRecompositionStrategy = defineGoalStrategy({
  id: 'BODY_RECOMPOSITION',
  label: 'Yleiskunto ja kehonkoostumus',
  requiredInputs: ['nykyinen harjoitusmäärä', 'käytettävissä oleva aika'],
  weeklyStructure: {
    STRENGTH: { min: 2, max: 3 },
    EASY_ENDURANCE: { min: 2, max: 3 },
  },
  keyWorkouts: ['STRENGTH', 'EASY_ENDURANCE'],
  progression: ['Lisää ensin toistoja tai kuormaa yhteen muuttujaan kerrallaan.'],
  deload: ['Kevennä määrää 25–40 %, jos palautumissäännöt täyttyvät.'],
  nutrition: {
    energyFocus: 'MAINTENANCE',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Painon ei tarvitse muuttua, jotta kehitystä voi tapahtua.'],
  },
  metrics: ['voimatasot', 'vyötärönympärys', 'harjoitusten toteutuminen'],
  conflictRules: ['WEIGHT_LOSS_VS_LOW_ENERGY'],
})
