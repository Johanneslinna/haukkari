import { defineGoalStrategy } from './strategyHelpers'

export const muscleGainStrategy = defineGoalStrategy({
  id: 'MUSCLE_GAIN',
  label: 'Lihasmassan kasvattaminen',
  requiredInputs: ['voimaharjoittelutausta', 'kohdelihakset', 'nykyinen sarjamäärä'],
  weeklyStructure: {
    STRENGTH: { min: 3, max: 5 },
    EASY_ENDURANCE: { min: 1, max: 2 },
  },
  keyWorkouts: ['STRENGTH'],
  progression: [
    'Aloita kohdelihaksille yleensä 8–12 haastavasta sarjasta viikossa.',
    'Pidä pääosin 1–3 hyvää toistoa varastossa ja etene toistoilla ennen kuormaa.',
  ],
  deload: ['Kevennä kertynyttä määrää, älä lisää sarjoja huonon toteuman päälle.'],
  nutrition: {
    energyFocus: 'APPROVED_SMALL_SURPLUS',
    proteinGramsPerKg: { min: 1.6, max: 2 },
    notes: ['Pieni energiaylijäämä on valinnainen ja vaatii käyttäjän hyväksynnän.'],
  },
  metrics: ['haastavat sarjat', 'toistot ja kuormat', 'palautuminen'],
  conflictRules: ['FAT_LOSS_VS_MAXIMAL_MUSCLE_GAIN', 'RUN_VOLUME_VS_LOWER_HYPERTROPHY'],
})
