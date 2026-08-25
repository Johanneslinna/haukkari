import type {
  DecisionTrace,
  ExercisePrescription,
  ExperienceLevel,
  GoalType,
  PrescribedSession,
  ReadinessState,
  SessionKind,
  WorkoutVariant,
  ExerciseLoadType,
  PrescriptionDose,
} from './types'
import {
  doseDurationSeconds,
  legacyDose,
  normalizePrescriptionV2,
  prescriptionDurationSeconds,
  prescriptionBlocks,
  withExerciseDose,
  withV2Blocks,
} from './PrescriptionContract'
import {
  CandidateSelector,
  ConstraintEngine,
  DecisionRecorder,
  ExerciseRanker,
  SessionObjectivePlanner,
} from './engine'
import {
  exerciseConflictsWithLimitations,
  exerciseLibrary as expandedExerciseLibrary,
  exerciseAllowedForExperience,
  verifiedTechniqueUrl,
  type ExerciseTemplate as LibraryExerciseTemplate,
} from './ExerciseLibrary'

export const TRAINING_RULE_VERSION = '2026.08.25-v2'

export type PrescriptionProfile = {
  goal: GoalType
  experience: ExperienceLevel
  equipment: string[]
  physicalLoad: 'LOW' | 'MODERATE' | 'HIGH'
  minutesPerSession: number
  likes?: string
  dislikes?: string
  limitations?: string
  healthBlocked?: boolean
  enduranceBackgroundKnown?: boolean
  medicationAffectsHeartRate?: boolean
  generatedAt?: string
}

type ExerciseTemplate = LibraryExerciseTemplate
const exerciseLibrary = expandedExerciseLibrary

const bodyweightCodes = new Set([
  'CHAIR_SQUAT',
  'BODYWEIGHT_SQUAT',
  'GLUTE_BRIDGE',
  'ELEVATED_PUSH_UP',
  'PUSH_UP',
  'PRONE_W_RAISE',
  'BIRD_DOG',
  'DEAD_BUG',
  'SUPPORTED_SPLIT_SQUAT',
  'KNEELING_SIDE_PLANK',
  'FRONT_PLANK',
  'MARCHING_DRILL',
  'FAST_HIGH_KNEES',
  'LOW_INTENSITY_ACCELERATION',
  'ANKLE_HOP',
  'COUNTERMOVEMENT_JUMP',
  'FAST_CALF_RAISE',
  'LOW_STEP_POWER',
  'ANKLE_ROCK',
  'CALF_MOBILITY',
  'HIP_FLEXOR_MOBILITY',
  'SUPINE_HIP_ROTATION',
  'THORACIC_ROTATION',
  'CAT_COW',
])

const dumbbellPerHandCodes = new Set([
  'DUMBBELL_FLOOR_PRESS',
  'DUMBBELL_BENCH_PRESS',
  'DUMBBELL_OVERHEAD_PRESS',
  'ONE_ARM_ROW',
  'FARMER_CARRY',
  'SUITCASE_CARRY',
])

function loadTracking(template: ExerciseTemplate): {
  loadType: ExerciseLoadType
  loadLabelFi: string
  loadOptions?: string[]
} {
  if (
    template.equipment.includes('Vastuskuminauhat') &&
    !template.equipment.includes('Kuntosalilaitteet')
  ) {
    return {
      loadType: 'BAND',
      loadLabelFi: 'Nauhan vastus',
      loadOptions: ['Erittäin kevyt', 'Kevyt', 'Keskivahva', 'Vahva', 'Erittäin vahva'],
    }
  }
  if (bodyweightCodes.has(template.code)) {
    return { loadType: 'BODYWEIGHT', loadLabelFi: 'Lisäpaino tai avustus (valinnainen)' }
  }
  if (template.equipment.includes('Kuntosalilaitteet')) {
    return { loadType: 'MACHINE_KG', loadLabelFi: 'Laitteen kuorma kg' }
  }
  if (dumbbellPerHandCodes.has(template.code)) {
    return { loadType: 'DUMBBELL_KG_EACH', loadLabelFi: 'Kuorma kg / käsipaino' }
  }
  return { loadType: 'EXTERNAL_KG', loadLabelFi: 'Kuorma kg' }
}

function chooseExercise(
  category: string,
  available: string[],
  likes: string,
  dislikes: string,
  fallbackCode: string,
  experience: ExperienceLevel,
  limitations: string,
) {
  const equipmentCandidates = CandidateSelector.select(exerciseLibrary, {
    category,
    equipment: available,
  })
  const safeCandidates = equipmentCandidates.filter(
    (candidate) => !exerciseConflictsWithLimitations(candidate, limitations),
  )
  const candidates = safeCandidates.filter(
    (candidate) =>
      exerciseAllowedForExperience(candidate, experience),
  )
  const preferred = ExerciseRanker.rank(candidates, {
    equipment: available,
    likes,
    dislikes,
  })[0]
  return (
    preferred ??
    candidates[0] ??
    safeCandidates.find((item) => item.code === fallbackCode) ??
    safeCandidates[0] ??
    exerciseLibrary.find(
      (item) =>
        item.equipment.includes('Kehonpaino') &&
        exerciseAllowedForExperience(item, 'BEGINNER') &&
        !exerciseConflictsWithLimitations(item, limitations),
    ) ??
    exerciseLibrary[0]!
  )
}

function strengthParameters(goal: GoalType, experience: ExperienceLevel) {
  if (goal === 'MAX_STRENGTH') {
    return {
      sets: experience === 'BEGINNER' ? 3 : 4,
      repetitions: experience === 'BEGINNER' ? '5–6' : '3–5',
      targetRpe: experience === 'BEGINNER' ? 7 : 8,
      targetRir: experience === 'BEGINNER' ? 3 : 2,
      restSeconds: experience === 'BEGINNER' ? 120 : 180,
    }
  }
  if (goal === 'MUSCLE_GAIN' || goal === 'BODY_RECOMPOSITION') {
    return {
      sets: experience === 'BEGINNER' ? 3 : 4,
      repetitions: '8–12',
      targetRpe: experience === 'BEGINNER' ? 7 : 8,
      targetRir: experience === 'BEGINNER' ? 3 : 2,
      restSeconds: 90,
    }
  }
  return {
    sets: experience === 'BEGINNER' ? 2 : 3,
    repetitions: '8–10',
    targetRpe: experience === 'BEGINNER' ? 6 : 7,
    targetRir: experience === 'BEGINNER' ? 4 : 3,
    restSeconds: 75,
  }
}

function decisionTrace(
  profile: PrescriptionProfile,
  rules: DecisionTrace['rules'],
  missingData: string[] = [],
): DecisionTrace {
  const healthModified =
    profile.healthBlocked ||
    profile.limitations?.trim() ||
    profile.physicalLoad === 'HIGH'
  return DecisionRecorder.record({
    ruleVersion: TRAINING_RULE_VERSION,
    generatedAt: profile.generatedAt ?? new Date().toISOString(),
    safetyOutcome: profile.healthBlocked
      ? 'REFER'
      : healthModified
        ? 'MODIFY'
        : 'PROCEED',
    confidence: missingData.length > 0 ? 'MODERATE' : 'HIGH',
    inputSummary: [
      `Tavoite: ${profile.goal}`,
      `Kokemus: ${profile.experience}`,
      `Välineet: ${profile.equipment.join(', ') || 'ei ilmoitettu'}`,
      `Fyysinen arjen kuorma: ${profile.physicalLoad}`,
      `Aika: ${profile.minutesPerSession} min`,
    ],
    missingData,
    rules,
  })
}

function toPrescription(
  sessionId: string,
  template: ExerciseTemplate,
  index: number,
  parameters: ReturnType<typeof strengthParameters>,
  profile: PrescriptionProfile,
): ExercisePrescription {
  const modified = profile.physicalLoad === 'HIGH' || Boolean(profile.limitations?.trim())
  const sets = Math.max(1, parameters.sets - (profile.physicalLoad === 'HIGH' ? 1 : 0))
  const targetRpe = Math.max(4, parameters.targetRpe - (modified ? 1 : 0))
  return {
    ...template,
    ...loadTracking(template),
    techniqueVideoUrl: verifiedTechniqueUrl(template),
    id: `${sessionId}-${template.code.toLocaleLowerCase('en-US')}`,
    sets,
    repetitions: parameters.repetitions,
    restSeconds: parameters.restSeconds,
    targetRpe,
    targetRir: Math.min(5, parameters.targetRir + (modified ? 1 : 0)),
    loadGuidance:
      'Valitse kuorma, jolla tavoitetoistot onnistuvat hallitusti ja sarjan lopussa jää ilmoitettu määrä hyviä toistoja varastoon.',
    keyExercise: index < 2,
    dose: {
      kind: 'STRENGTH_SETS',
      sets,
      repetitions: parameters.repetitions,
      restSeconds: parameters.restSeconds,
      targetRpe,
      targetRir: Math.min(5, parameters.targetRir + (modified ? 1 : 0)),
    },
  }
}

function strengthSeconds(exercise: ExercisePrescription) {
  return doseDurationSeconds(legacyDose(exercise))
}

function fitStrengthToBudget(
  exercises: ExercisePrescription[],
  warmupMinutes: number,
  cooldownMinutes: number,
  budgetMinutes: number,
) {
  const budgetSeconds = Math.max(60, budgetMinutes * 60)
  const fixedSeconds = (warmupMinutes + cooldownMinutes) * 60
  const next = exercises.map((exercise) => ({ ...exercise }))
  const total = () => fixedSeconds + next.reduce((sum, item) => sum + strengthSeconds(item), 0)

  while (total() > budgetSeconds) {
    const reducible = [...next]
      .reverse()
      .find((exercise) => legacyDose(exercise).kind === 'STRENGTH_SETS' && exercise.sets > 1)
    if (reducible) {
      reducible.sets -= 1
      const dose = legacyDose(reducible)
      if (dose.kind === 'STRENGTH_SETS') reducible.dose = { ...dose, sets: reducible.sets }
      continue
    }
    let removableIndex = next.findLastIndex((exercise) => !exercise.keyExercise)
    if (removableIndex < 0 && next.length > 1) removableIndex = next.length - 1
    if (removableIndex >= 0) {
      next.splice(removableIndex, 1)
      continue
    }
    break
  }
  return next
}

export function exerciseSubstitutions(
  exercise: ExercisePrescription,
  availableEquipment: string[],
): ExercisePrescription[] {
  return exercise.substitutions.flatMap((name) => {
    const template = exerciseLibrary.find((candidate) => candidate.nameFi === name)
    if (
      !template ||
      !ConstraintEngine.exerciseIsAvailable(template.equipment, availableEquipment)
    ) {
      return []
    }
    return [
      {
        ...exercise,
        ...template,
        ...loadTracking(template),
        techniqueVideoUrl: verifiedTechniqueUrl(template),
        id: `${exercise.id}-sub-${template.code.toLocaleLowerCase('en-US')}`,
      },
    ]
  })
}

function prescribeStrength(
  sessionId: string,
  title: string,
  kind: SessionKind,
  durationMinutes: number,
  profile: PrescriptionProfile,
): PrescribedSession {
  const likes = profile.likes?.toLocaleLowerCase('fi-FI') ?? ''
  const dislikes = profile.dislikes?.toLocaleLowerCase('fi-FI') ?? ''
  const available = profile.equipment.length ? profile.equipment : ['Kehonpaino']
  const categories = [
    ['Kyykky', 'CHAIR_SQUAT'],
    ['Lannesarana', 'GLUTE_BRIDGE'],
    ['Työntö', 'ELEVATED_PUSH_UP'],
    ['Veto', 'BAND_ROW'],
    ['Keskivartalo', 'DEAD_BUG'],
  ] as const
  const parameters = strengthParameters(profile.goal, profile.experience)
  const candidateExercises = categories.map(([category, fallback], index) =>
    toPrescription(
      sessionId,
      chooseExercise(
        category,
        available,
        likes,
        dislikes,
        fallback,
        profile.experience,
        profile.limitations ?? '',
      ),
      index,
      parameters,
      profile,
    ),
  )
  const timeBudgetMinutes = Math.max(
    5,
    Math.min(durationMinutes, profile.minutesPerSession),
  )
  const warmupMinutes = timeBudgetMinutes <= 10 ? 2 : timeBudgetMinutes <= 20 ? 3 : 5
  const cooldownMinutes = timeBudgetMinutes <= 10 ? 1 : timeBudgetMinutes <= 20 ? 2 : 3
  const exercises = fitStrengthToBudget(
    candidateExercises,
    warmupMinutes,
    cooldownMinutes,
    timeBudgetMinutes,
  )
  const missingData = available.every((item) => item === 'Kehonpaino')
    ? [
        'Vetoliikkeen kuormitusväline puuttuu; käytössä on konservatiivinen kehonpainovaihtoehto.',
      ]
    : []
  const decision = decisionTrace(
    profile,
    [
      {
        ruleId: 'RT-FREQUENCY-001',
        outcome: 'PROCEED',
        message:
          'Voimaharjoitus käyttää suuria lihasryhmiä kattavaa kokovartalorakennetta.',
        evidenceIds: ['ACSM-RT-2026', 'WHO-PA-2020'],
      },
      {
        ruleId: 'RT-EFFORT-002',
        outcome: profile.healthBlocked
          ? 'REFER'
          : profile.limitations
            ? 'MODIFY'
            : 'PROCEED',
        message:
          profile.experience === 'BEGINNER'
            ? 'Aloittelijan sarjat jätetään vähintään noin kolme hyvää toistoa vajaiksi.'
            : 'Kuorma ohjataan RPE/RIR-tavoitteella ilman pakollista uupumukseen harjoittelua.',
        evidenceIds: ['ACSM-RT-2026', 'RPE-META-2022'],
      },
      ...(profile.physicalLoad === 'HIGH'
        ? [
            {
              ruleId: 'LOAD-WORK-003',
              outcome: 'MODIFY' as const,
              message:
                'Korkea fyysinen arjen kuorma vähentää sarjamäärää ja tavoite-RPE:tä.',
              evidenceIds: ['APP-CONSERVATIVE-LOAD-RULE'],
            },
          ]
        : []),
    ],
    missingData,
  )
  const estimatedMinutes = Math.max(
    5,
    Math.ceil(
      ((warmupMinutes + cooldownMinutes) * 60 +
        exercises.reduce((sum, exercise) => sum + strengthSeconds(exercise), 0)) /
        60,
    ),
  )
  return withV2Blocks({
    id: sessionId,
    title,
    kind,
    goal: profile.goal,
    durationMinutes: Math.min(timeBudgetMinutes, estimatedMinutes),
    timeBudgetMinutes,
    objective: {
      ...SessionObjectivePlanner.plan(kind, profile.goal),
      primary: 'Kokovartalon voima',
      secondary: ['Liikehallinta'],
      fatigueBudget: profile.physicalLoad === 'HIGH' ? 'LOW' : 'MODERATE',
      avoid: profile.limitations?.trim() ? ['Oiretta provosoivat liikkeet'] : [],
    },
    warmupMinutes,
    warmup: [
      '5 min rauhallista kävelyä tai muuta kevyttä sykettä nostavaa liikettä',
      '1 kevyt harjoitussarja päivän kahdesta ensimmäisestä liikkeestä',
    ],
    exercises,
    cooldownMinutes,
    cooldown: ['3 min rauhallista liikettä ja hengityksen tasaus'],
    progression:
      'Kun kaikki sarjat osuvat toistoalueen yläpäähän samalla tai alemmalla RPE:llä kahdessa harjoituksessa, lisää pienin mahdollinen kuorma tai 1 toisto sarjaa kohti.',
    decisionTrace: decision,
  })
}

function aerobicMode(profile: PrescriptionProfile) {
  const text = `${profile.likes ?? ''} ${profile.dislikes ?? ''}`.toLocaleLowerCase(
    'fi-FI',
  )
  if (text.includes('pyörä') && !text.includes('en pidä pyör')) return 'pyöräily'
  if (text.includes('juoks') && !text.includes('en pidä juoks')) return 'kävely–juoksu'
  return 'reipas kävely tai muu nivelille sopiva aerobinen liike'
}

function prescribeAerobic(
  sessionId: string,
  title: string,
  kind: SessionKind,
  durationMinutes: number,
  profile: PrescriptionProfile,
): PrescribedSession {
  const total = Math.max(5, Math.min(durationMinutes, profile.minutesPerSession))
  const mode = aerobicMode(profile)
  const hardAllowed = !profile.healthBlocked && !profile.limitations?.trim()
  const interval = kind === 'INTERVAL' && hardAllowed
  const warmupMinutes = total <= 10 ? 2 : total <= 20 ? 3 : 5
  const cooldownMinutes = total <= 10 ? 1 : total <= 20 ? 2 : 5
  const mainSeconds = Math.max(60, (total - warmupMinutes - cooldownMinutes) * 60)
  const workSeconds = total <= 20 ? 120 : 180
  const recoverySeconds = total <= 20 ? 60 : 120
  const repetitions = Math.max(
    1,
    Math.min(6, Math.floor((mainSeconds + recoverySeconds) / (workSeconds + recoverySeconds))),
  )
  const useIntervals = interval && repetitions >= 2
  const dose: PrescriptionDose = useIntervals
    ? {
        kind: 'INTERVAL_BLOCKS',
        repetitions,
        workSeconds,
        recoverySeconds,
        targetRpe: 7,
        intensityCue: 'Reipas mutta tasalaatuinen; viimeisen vedon pitää pysyä hallittuna.',
      }
    : {
        kind: 'CONTINUOUS_TIME',
        durationSeconds: mainSeconds,
        targetRpe: 4,
        intensityCue: 'Pystyt puhumaan kokonaisia lauseita.',
      }
  const exercises: ExercisePrescription[] = [
    {
      id: `${sessionId}-main`,
      code: useIntervals ? 'CONTROLLED_INTERVALS' : 'EASY_AEROBIC',
      nameFi: useIntervals ? 'Hallitut intervallit' : 'Helppo peruskestävyys',
      category: 'Kestävyys',
      equipment: [],
      instructionsFi: useIntervals
        ? `Tee ${mode} muodossa ${repetitions} × ${Math.round(workSeconds / 60)} min reippaasti (RPE 7), välissä ${Math.round(recoverySeconds / 60)} min erittäin kevyesti.`
        : `Tee ${mode} muodossa tasaisesti. Pystyt puhumaan kokonaisia lauseita koko työosuuden ajan.`,
      sets: useIntervals ? repetitions : 1,
      durationSeconds: useIntervals ? workSeconds : mainSeconds,
      restSeconds: useIntervals ? recoverySeconds : 0,
      targetRpe: useIntervals ? 7 : 4,
      loadGuidance: useIntervals
        ? 'Ensimmäisen vedon pitää tuntua hallitulta; pidä kaikki vedot tasalaatuisina.'
        : 'Säädä vauhtia puhetestillä, ei oletetulla sykealueella.',
      stopCondition:
        'Lopeta ja hakeudu arvioon, jos ilmenee rintakipua, pyörtymisen tunnetta tai poikkeavaa hengenahdistusta.',
      substitutions: ['Kävely', 'Kuntopyörä', 'Vesiliikunta'],
      loadType: 'LEVEL',
      loadLabelFi: 'Vauhti tai vastustaso',
      keyExercise: true,
      dose,
    },
  ]
  const decision = decisionTrace(
    profile,
    [
      {
        ruleId: useIntervals ? 'END-INTERVAL-002' : 'END-EASY-002',
        outcome: useIntervals ? 'PROCEED' : kind === 'INTERVAL' ? 'MODIFY' : 'PROCEED',
        message: useIntervals
          ? 'Intervallit ovat erillisiä vetoja, joiden välissä on aktiivinen palautus.'
          : kind === 'INTERVAL'
            ? 'Aikaraja, rajoite tai terveysesto muuttaa intervallin helpoksi peruskestävyydeksi.'
            : 'Peruskestävyys ohjataan puhetestillä ja koetulla kuormittavuudella.',
        evidenceIds: ['WHO-PA-2020', 'IOC-ARI-2022'],
      },
      ...(profile.medicationAffectsHeartRate
        ? [
            {
              ruleId: 'END-HR-MEDICATION-001',
              outcome: 'MODIFY' as const,
              message:
                'Sykkeeseen vaikuttavan lääkityksen vuoksi teho ohjataan RPE:llä ja puhetestillä, ei laskennallisella sykealueella.',
              evidenceIds: ['APP-HR-CONFIDENCE-RULE'],
            },
          ]
        : []),
    ],
    profile.enduranceBackgroundKnown === false
      ? ['Kestävyys- ja lajitaustan vertailukelpoinen lähtötieto']
      : [],
  )
  return withV2Blocks({
    id: sessionId,
    title: useIntervals ? title : 'Helppo peruskestävyys',
    kind: useIntervals ? kind : 'EASY_ENDURANCE',
    goal: profile.goal,
    durationMinutes: total,
    timeBudgetMinutes: total,
    objective: {
      primary: useIntervals ? 'Hallittu vauhtikestävyys' : 'Aerobinen peruskestävyys',
      secondary: ['Palautumiskyky'],
      fatigueBudget: useIntervals ? 'MODERATE' : 'LOW',
      avoid: profile.healthBlocked ? ['Kova rasitus'] : [],
    },
    warmupMinutes,
    warmup: ['5 min erittäin kevyesti; tehon pitää tuntua selvästi helpolta'],
    exercises,
    cooldownMinutes,
    cooldown: ['5 min erittäin kevyesti ja hengityksen tasaus'],
    progression:
      'Lisää helppoon viikkokokonaisuuteen 5–10 minuuttia vasta, kun nykyinen määrä toteutuu ilman oireita ja palautuminen pysyy normaalina.',
    decisionTrace: decision,
  })
}

function prescribeMobility(
  sessionId: string,
  title: string,
  kind: SessionKind,
  durationMinutes: number,
  profile: PrescriptionProfile,
): PrescribedSession {
  const recovery = kind === 'RECOVERY'
  const timeBudgetMinutes = Math.max(
    5,
    Math.min(durationMinutes, profile.minutesPerSession),
  )
  const warmupMinutes = Math.min(2, Math.max(1, timeBudgetMinutes - 2))
  const cooldownMinutes = 1
  const items = [
    ['CAT_COW', 'Selän rauhallinen pyöristys ja ojennus', '6–8 rauhallista toistoa'],
    ['HIP_SHIFT', 'Lantion painonsiirto', '6–8 toistoa / puoli'],
    ['WALL_SLIDE', 'Lapojen seinäliuku', '6–10 toistoa'],
  ]
  const exercises = items
    .slice(0, timeBudgetMinutes <= 7 ? 2 : 3)
    .map(([code, nameFi, repetitions], index) => ({
      id: `${sessionId}-${code.toLocaleLowerCase('en-US')}`,
      code,
      nameFi,
      category: 'Liikkuvuus ja hallinta',
      equipment: ['Kehonpaino'],
      instructionsFi: 'Liiku hitaasti vain kivuttomalla ja hallitulla liikeradalla.',
      sets: timeBudgetMinutes <= 7 ? 1 : 2,
      repetitions,
      restSeconds: 30,
      targetRpe: recovery ? 2 : 3,
      loadGuidance: 'Liikeradan laatu ratkaisee; älä lisää ulkoista kuormaa.',
      stopCondition:
        'Lopeta liike, jos kipu lisääntyy tai tulee puutumista tai huimausta.',
      substitutions: ['Rauhallinen kävely', 'Pienempi liikerata'],
      loadType: 'NONE' as const,
      loadLabelFi: 'Ei ulkoista kuormaa',
      keyExercise: index === 0,
      dose: {
        kind: 'SKILL_DRILL' as const,
        sets: timeBudgetMinutes <= 7 ? 1 : 2,
        repetitions,
        recoverySeconds: 30,
        targetRpe: recovery ? 2 : 3,
        qualityCue: 'Liiku vain kivuttomalla ja hallitulla liikeradalla.',
      },
    }))
  return withV2Blocks({
    id: sessionId,
    title,
    kind,
    goal: profile.goal,
    durationMinutes: timeBudgetMinutes,
    timeBudgetMinutes,
    objective: {
      primary: recovery ? 'Palautuminen' : 'Liikkuvuus ja liikehallinta',
      secondary: [],
      fatigueBudget: 'LOW',
      avoid: ['Kivun provosointi'],
    },
    warmupMinutes,
    warmup: ['2 min rauhallista kävelyä ja hengityksen tasaus'],
    exercises,
    cooldownMinutes,
    cooldown: ['1 min rauhallista hengitystä'],
    progression:
      'Lisää ensin hallittua liikerataa, ei kipua eikä venytyksen pakottamista.',
    decisionTrace: decisionTrace(profile, [
      {
        ruleId: recovery ? 'RECOVERY-001' : 'MOBILITY-001',
        outcome: recovery ? 'MODIFY' : 'PROCEED',
        message: recovery
          ? 'Palauttava harjoitus pidetään erittäin kevyenä ja oireohjattuna.'
          : 'Liikkuvuusharjoitus käyttää hallittuja, kivuttomia liikeratoja.',
        evidenceIds: ['WHO-PA-2020', 'APP-CONSERVATIVE-LOAD-RULE'],
      },
    ]),
  })
}

function prescribeSpeedPower(
  sessionId: string,
  title: string,
  durationMinutes: number,
  profile: PrescriptionProfile,
): PrescribedSession {
  const timeBudgetMinutes = Math.max(
    5,
    Math.min(durationMinutes, profile.minutesPerSession),
  )
  const warmupMinutes = timeBudgetMinutes <= 10 ? 2 : timeBudgetMinutes <= 20 ? 5 : 8
  const cooldownMinutes = timeBudgetMinutes <= 10 ? 1 : timeBudgetMinutes <= 20 ? 2 : 4
  const sprintRepetitions = timeBudgetMinutes <= 20 ? 4 : 6
  const jumpSets = timeBudgetMinutes <= 20 ? 2 : 3
  const speedExercises: ExercisePrescription[] = [
    {
      id: `${sessionId}-acceleration`,
      code: 'ACCELERATION_SPRINT',
      nameFi: 'Lyhyt kiihdytys',
      category: 'Sprintti',
      equipment: ['Kehonpaino'],
      instructionsFi: 'Kiihdytä rennosti 15 metriä. Jokaisen suorituksen pitää olla terävä ja hallittu.',
      sets: sprintRepetitions,
      repetitions: '15 m',
      restSeconds: 75,
      targetRpe: 7,
      loadGuidance: 'Palauta niin pitkään, että seuraava suoritus on yhtä laadukas.',
      stopCondition: 'Lopeta, jos nopeus laskee selvästi, tekniikka hajoaa tai tunnet kipua.',
      substitutions: ['Porraskiihdytys', 'Kuntopyörän lyhyt kiihdytys'],
      loadType: 'NONE',
      loadLabelFi: 'Ei ulkoista kuormaa',
      keyExercise: true,
      dose: {
        kind: 'SPRINT_REPS',
        repetitions: sprintRepetitions,
        distanceMeters: 15,
        recoverySeconds: 75,
        targetRpe: 7,
        qualityStopRule: 'Lopeta ennen kuin nopeus tai tekniikka heikkenee selvästi.',
      },
    },
    {
      id: `${sessionId}-jump`,
      code: 'COUNTERMOVEMENT_JUMP',
      nameFi: 'Hallittu ponnistushyppy',
      category: 'Hypyt',
      equipment: ['Kehonpaino'],
      instructionsFi: 'Tee yksittäiset hypyt hyvällä alastulolla. Nollaa asento jokaisen hypyn välissä.',
      sets: jumpSets,
      repetitions: '3',
      restSeconds: 75,
      targetRpe: 7,
      loadGuidance: 'Laatu ratkaisee; älä tee hyppyjä uupumukseen.',
      stopCondition: 'Lopeta, jos alastulo ei pysy hallittuna tai tunnet nivelkipua.',
      substitutions: ['Nopea varpaille nousu', 'Matalan korokkeen step-up'],
      loadType: 'NONE',
      loadLabelFi: 'Ei ulkoista kuormaa',
      keyExercise: true,
      dose: {
        kind: 'JUMP_REPS',
        sets: jumpSets,
        repetitions: 3,
        recoverySeconds: 75,
        targetRpe: 7,
        qualityStopRule: 'Lopeta ennen kuin ponnistus tai alastulon hallinta heikkenee.',
      },
    },
  ]
  const exercises = speedExercises.slice(0, timeBudgetMinutes <= 10 ? 1 : 2)
  return withV2Blocks({
    id: sessionId,
    title,
    kind: 'SPEED_POWER',
    goal: profile.goal,
    durationMinutes: timeBudgetMinutes,
    timeBudgetMinutes,
    objective: {
      primary: 'Nopeus ja räjähtävä voima',
      secondary: ['Ponnistus- ja alastulotekniikka'],
      fatigueBudget: 'LOW',
      avoid: ['Uupumukseen harjoittelu'],
    },
    warmupMinutes,
    warmup: [`${warmupMinutes} min asteittain tehostuvaa lämmittelyä ja 2 kevyttä kiihdytystä`],
    exercises,
    cooldownMinutes,
    cooldown: [`${cooldownMinutes} min erittäin kevyttä liikettä`],
    progression: 'Lisää ensin suorituksen laatua. Lisää yksi toisto vasta, kun kaikki toistot pysyvät yhtä terävinä.',
    decisionTrace: decisionTrace(profile, [
      {
        ruleId: 'SPEED-QUALITY-001',
        outcome: profile.healthBlocked ? 'REFER' : profile.limitations?.trim() ? 'MODIFY' : 'PROCEED',
        message: 'Nopeus- ja hyppyannos päättyy ennen selvää laadun heikkenemistä.',
        evidenceIds: ['APP-QUALITY-STOP-RULE'],
      },
    ]),
  })
}

export function prescribeSession(input: {
  sessionId: string
  title: string
  kind: SessionKind
  durationMinutes: number
  profile: PrescriptionProfile
}): PrescribedSession {
  if (input.kind === 'STRENGTH') {
    return prescribeStrength(
      input.sessionId,
      input.title,
      input.kind,
      input.durationMinutes,
      input.profile,
    )
  }
  if (input.kind === 'SPEED_POWER') {
    return prescribeSpeedPower(
      input.sessionId,
      input.title,
      input.durationMinutes,
      input.profile,
    )
  }
  if (input.kind === 'EASY_ENDURANCE' || input.kind === 'INTERVAL') {
    return prescribeAerobic(
      input.sessionId,
      input.title,
      input.kind,
      input.durationMinutes,
      input.profile,
    )
  }
  if (input.kind === 'MOBILITY' || input.kind === 'RECOVERY' || input.kind === 'REST') {
    return prescribeMobility(
      input.sessionId,
      input.title,
      input.kind === 'REST' ? 'RECOVERY' : input.kind,
      Math.max(5, input.durationMinutes),
      input.profile,
    )
  }
  return prescribeMobility(
    input.sessionId,
    input.title,
    input.kind,
    input.durationMinutes,
    input.profile,
  )
}

function compactExerciseLimit(minutes: number) {
  if (minutes <= 10) return 2
  if (minutes <= 20) return 3
  return 4
}

function fitDoseToSeconds(
  exercise: ExercisePrescription,
  maxSeconds: number,
  light: boolean,
) {
  const dose = legacyDose(exercise)
  const targetRpe = light ? Math.min(6, dose.targetRpe) : dose.targetRpe
  switch (dose.kind) {
    case 'STRENGTH_SETS': {
      let sets = light ? Math.max(1, Math.ceil(dose.sets * 0.65)) : dose.sets
      while (
        sets > 1 &&
        doseDurationSeconds({ ...dose, sets, targetRpe }) > maxSeconds
      ) {
        sets -= 1
      }
      return withExerciseDose(exercise, {
        ...dose,
        sets,
        targetRpe,
        targetRir: light
          ? Math.min(5, (dose.targetRir ?? 2) + 1)
          : dose.targetRir,
      })
    }
    case 'CONTINUOUS_TIME':
      return withExerciseDose(exercise, {
        ...dose,
        durationSeconds: Math.max(60, Math.min(dose.durationSeconds, maxSeconds)),
        targetRpe,
      })
    case 'INTERVAL_BLOCKS': {
      const cycleSeconds = dose.workSeconds + dose.recoverySeconds
      const maximumRepetitions = Math.max(
        1,
        Math.floor((maxSeconds + dose.recoverySeconds) / cycleSeconds),
      )
      return withExerciseDose(exercise, {
        ...dose,
        repetitions: Math.min(
          light ? Math.max(1, Math.ceil(dose.repetitions * 0.65)) : dose.repetitions,
          maximumRepetitions,
        ),
        workSeconds: Math.min(dose.workSeconds, Math.max(30, maxSeconds)),
        targetRpe,
      })
    }
    case 'SPRINT_REPS': {
      const maximumRepetitions = Math.max(
        1,
        Math.floor((maxSeconds + dose.recoverySeconds) / (10 + dose.recoverySeconds)),
      )
      return withExerciseDose(exercise, {
        ...dose,
        repetitions: Math.min(
          light ? Math.max(1, Math.ceil(dose.repetitions * 0.65)) : dose.repetitions,
          maximumRepetitions,
        ),
        targetRpe,
      })
    }
    case 'JUMP_REPS': {
      const maximumSets = Math.max(
        1,
        Math.floor((maxSeconds + dose.recoverySeconds) / (30 + dose.recoverySeconds)),
      )
      return withExerciseDose(exercise, {
        ...dose,
        sets: Math.min(
          light ? Math.max(1, Math.ceil(dose.sets * 0.65)) : dose.sets,
          maximumSets,
        ),
        targetRpe,
      })
    }
    case 'SKILL_DRILL': {
      const sets = light ? Math.max(1, Math.ceil(dose.sets * 0.65)) : dose.sets
      return withExerciseDose(exercise, {
        ...dose,
        sets,
        durationSeconds: dose.durationSeconds
          ? Math.max(60, Math.min(dose.durationSeconds, maxSeconds))
          : undefined,
        targetRpe,
      })
    }
  }
}

export function adaptPrescription(
  prescription: PrescribedSession,
  variant: WorkoutVariant,
  readiness: ReadinessState,
): PrescribedSession {
  if (readiness === 'ORANGE_RECOVERY') {
    return prescribeMobility(
      `${prescription.id}-recovery`,
      'Palauttava vaihtoehto',
      'RECOVERY',
      Math.min(20, variant.durationMinutes),
      {
        goal: prescription.goal,
        experience: 'BEGINNER',
        equipment: ['Kehonpaino'],
        physicalLoad: 'HIGH',
        minutesPerSession: Math.min(20, variant.durationMinutes),
        limitations: 'Päivän kuntotarkistus ohjaa palauttavaan harjoitukseen.',
      },
    )
  }

  const normalized = normalizePrescriptionV2(prescription)
  const compact = variant.kind.startsWith('COMPACT')
  const light = variant.kind === 'LIGHT' || readiness === 'YELLOW'
  const limit = compact ? compactExerciseLimit(variant.durationMinutes) : Infinity
  const compactWarmupMinutes =
    variant.durationMinutes <= 10 ? 2 : variant.durationMinutes <= 20 ? 3 : 5
  const compactCooldownMinutes =
    variant.durationMinutes <= 10 ? 1 : variant.durationMinutes <= 20 ? 2 : 5
  const effectiveWarmupMinutes = compact
    ? compactWarmupMinutes
    : (normalized.warmupMinutes ?? 0)
  const effectiveCooldownMinutes = compact
    ? compactCooldownMinutes
    : (normalized.cooldownMinutes ?? 0)
  const compactWorkMinutes = Math.max(
    1,
    variant.durationMinutes - effectiveWarmupMinutes - effectiveCooldownMinutes,
  )
  const selectedCandidates = [...prescriptionBlocks(normalized)]
    .sort((left, right) => Number(right.keyExercise) - Number(left.keyExercise))
    .slice(0, limit)
  let remainingWorkSeconds = compactWorkMinutes * 60
  const selected = selectedCandidates.map((exercise, index) => {
    const remainingExercises = selectedCandidates.length - index
    const share = Math.max(60, Math.floor(remainingWorkSeconds / remainingExercises))
    const adapted = fitDoseToSeconds(exercise, share, light)
    remainingWorkSeconds = Math.max(
      0,
      remainingWorkSeconds - doseDurationSeconds(legacyDose(adapted)),
    )
    return adapted
  })

  const adaptationRule = compact
    ? {
        ruleId: 'TIME-COMPACT-001',
        outcome: 'MODIFY' as const,
        message: `Aikaraja säilyttää avainliikkeet ensin ja rajaa harjoituksen ${variant.durationMinutes} minuuttiin.`,
        evidenceIds: ['APP-KEY-DOSE-RULE'],
      }
    : light
      ? {
          ruleId: 'READINESS-YELLOW-001',
          outcome: 'MODIFY' as const,
          message:
            'Keltainen valmius vähentää sarjoja ja rajaa tavoite-RPE:n enintään kuuteen.',
          evidenceIds: ['APP-CONSERVATIVE-LOAD-RULE'],
        }
      : {
          ruleId: 'READINESS-GREEN-001',
          outcome: 'PROCEED' as const,
          message: 'Päivän valmius sallii suunnitellun version.',
          evidenceIds: ['APP-READINESS-RULE'],
        }

  const adapted: PrescribedSession = {
    ...normalized,
    title: compact
      ? `${normalized.title} · ${variant.durationMinutes} min`
      : normalized.title,
    durationMinutes: variant.durationMinutes,
    timeBudgetMinutes: variant.durationMinutes,
    warmupMinutes: compact
      ? compactWarmupMinutes
      : normalized.warmupMinutes,
    warmup: compact
      ? [`${compactWarmupMinutes} min erittäin kevyesti ja hallitusti`]
      : normalized.warmup,
    exercises: selected,
    blocks: selected,
    cooldownMinutes: compact
      ? compactCooldownMinutes
      : normalized.cooldownMinutes,
    cooldown: compact
      ? [`${compactCooldownMinutes} min rauhallisesti ja hengityksen tasaus`]
      : normalized.cooldown,
    decisionTrace: {
      ...normalized.decisionTrace,
      safetyOutcome:
        light || compact ? 'MODIFY' : normalized.decisionTrace.safetyOutcome,
      rules: [...normalized.decisionTrace.rules, adaptationRule],
    },
  }
  adapted.durationMinutes = Math.min(
    variant.durationMinutes,
    Math.max(1, Math.ceil(prescriptionDurationSeconds(adapted) / 60)),
  )
  return adapted
}

export const TrainingPrescriptionEngine = {
  adapt: adaptPrescription,
  prescribe: prescribeSession,
  substitutions: exerciseSubstitutions,
}
