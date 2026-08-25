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
import { DecisionRecorder } from './engine'
import {
  ADULT_RESISTANCE_RULE_VERSION,
  prescribeAdultResistanceSession,
  type AdultResistanceSetHistory,
} from './AdultResistanceEngine'
import {
  publishedExerciseCatalog,
  TRAINING_CONTENT_RELEASE,
} from './content/TrainingContent'
import type { PrescriptionResult, UnsupportedPrescription } from './types'

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
  age?: number
  environment?: 'HOME' | 'GYM'
  readiness?: ReadinessState
  supervisionAvailable?: boolean
  strengthHistory?: AdultResistanceSetHistory[]
  contentReleaseId?: string
  ruleVersion?: string
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
    generatedAt: profile.generatedAt ?? TRAINING_CONTENT_RELEASE.publishedAt,
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

export function exerciseSubstitutions(
  exercise: ExercisePrescription,
  availableEquipment: string[],
): ExercisePrescription[] {
  return exercise.substitutions.flatMap((name) => {
    const template = publishedExerciseCatalog
      .listExercises()
      .find((candidate) => candidate.nameFi === name && candidate.status === 'PUBLISHED')
    if (
      !template ||
      !template.equipment.some((item) => availableEquipment.includes(item))
    )
      return []
    const primaryLoadType = template.loadTypes[0]
    const loadType: ExerciseLoadType =
      primaryLoadType === 'BAND' ||
      primaryLoadType === 'BODYWEIGHT' ||
      primaryLoadType === 'DUMBBELL_KG_EACH' ||
      primaryLoadType === 'MACHINE_KG'
        ? primaryLoadType
        : 'EXTERNAL_KG'
    return [
      {
        ...exercise,
        code: template.code,
        nameFi: template.nameFi,
        category: template.movementPatterns[0] ?? exercise.category,
        equipment: [...template.equipment],
        instructionsFi: template.instructionsFi.join(' '),
        substitutions: template.substitutionCodes
          .map((code) => publishedExerciseCatalog.getExercise(code)?.nameFi)
          .filter((value): value is string => Boolean(value)),
        loadType,
        loadLabelFi:
          loadType === 'BAND'
            ? 'Nauhan vastus'
            : loadType === 'BODYWEIGHT'
              ? 'Variaatio tai lisäpaino'
              : loadType === 'DUMBBELL_KG_EACH'
                ? 'Kuorma kg / käsipaino'
                : loadType === 'MACHINE_KG'
                  ? 'Laitteen kuorma kg'
                  : 'Kuorma kg',
        loadOptions:
          loadType === 'BAND'
            ? ['Erittäin kevyt', 'Kevyt', 'Keskivahva', 'Vahva', 'Erittäin vahva']
            : undefined,
        id: `${exercise.id}-sub-${template.code.toLocaleLowerCase('en-US')}`,
      },
    ]
  })
}

function prescribeStrength(
  sessionId: string,
  title: string,
  durationMinutes: number,
  profile: PrescriptionProfile,
): PrescribedSession {
  const limitationText = profile.limitations?.toLocaleLowerCase('fi-FI') ?? ''
  const limitationTags = [
    ...(limitationText.includes('polv') ? ['ACUTE_KNEE_PAIN'] : []),
    ...(limitationText.includes('selk') ? ['ACUTE_BACK_PAIN'] : []),
    ...(limitationText.includes('olkap') ? ['ACUTE_SHOULDER_PAIN'] : []),
    ...(limitationText.includes('kävel') || limitationText.includes('askel')
      ? ['GAIT_ALTERING_PAIN']
      : []),
  ]
  const likes = profile.likes?.toLocaleLowerCase('fi-FI') ?? ''
  const dislikes = profile.dislikes?.toLocaleLowerCase('fi-FI') ?? ''
  const likedExerciseCodes = publishedExerciseCatalog
    .listExercises()
    .filter((exercise) => likes.includes(exercise.nameFi.toLocaleLowerCase('fi-FI')))
    .map((exercise) => exercise.code)
  const dislikedExerciseCodes = publishedExerciseCatalog
    .listExercises()
    .filter((exercise) => dislikes.includes(exercise.nameFi.toLocaleLowerCase('fi-FI')))
    .map((exercise) => exercise.code)
  return prescribeAdultResistanceSession({
    sessionId,
    title,
    context: {
      age: profile.age ?? 18,
      contentReleaseId: profile.contentReleaseId ?? TRAINING_CONTENT_RELEASE.releaseId,
      ruleVersion: profile.ruleVersion ?? ADULT_RESISTANCE_RULE_VERSION,
      experience: profile.experience,
      goal: profile.goal,
      equipment: profile.equipment.length ? profile.equipment : ['Kehonpaino'],
      environment:
        profile.environment ??
        (profile.equipment.includes('Kuntosalilaitteet') ||
        profile.equipment.includes('Levytanko ja painot')
          ? 'GYM'
          : 'HOME'),
      availableMinutes: Math.max(
        10,
        Math.min(durationMinutes, profile.minutesPerSession),
      ),
      generatedAt: profile.generatedAt ?? TRAINING_CONTENT_RELEASE.publishedAt,
      physicalLoad: profile.physicalLoad,
      readiness: profile.readiness ?? 'GREEN',
      limitationTags,
      dislikedExerciseCodes,
      likedExerciseCodes,
      supervisionAvailable: profile.supervisionAvailable ?? false,
    },
    history: profile.strengthHistory,
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
    Math.min(
      6,
      Math.floor((mainSeconds + recoverySeconds) / (workSeconds + recoverySeconds)),
    ),
  )
  const useIntervals = interval && repetitions >= 2
  const dose: PrescriptionDose = useIntervals
    ? {
        kind: 'INTERVAL_BLOCKS',
        repetitions,
        workSeconds,
        recoverySeconds,
        targetRpe: 7,
        intensityCue:
          'Reipas mutta tasalaatuinen; viimeisen vedon pitää pysyä hallittuna.',
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

export function prescribeSpeedPowerDraft(
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
      instructionsFi:
        'Kiihdytä rennosti 15 metriä. Jokaisen suorituksen pitää olla terävä ja hallittu.',
      sets: sprintRepetitions,
      repetitions: '15 m',
      restSeconds: 75,
      targetRpe: 7,
      loadGuidance: 'Palauta niin pitkään, että seuraava suoritus on yhtä laadukas.',
      stopCondition:
        'Lopeta, jos nopeus laskee selvästi, tekniikka hajoaa tai tunnet kipua.',
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
      instructionsFi:
        'Tee yksittäiset hypyt hyvällä alastulolla. Nollaa asento jokaisen hypyn välissä.',
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
    warmup: [
      `${warmupMinutes} min asteittain tehostuvaa lämmittelyä ja 2 kevyttä kiihdytystä`,
    ],
    exercises,
    cooldownMinutes,
    cooldown: [`${cooldownMinutes} min erittäin kevyttä liikettä`],
    progression:
      'Lisää ensin suorituksen laatua. Lisää yksi toisto vasta, kun kaikki toistot pysyvät yhtä terävinä.',
    decisionTrace: decisionTrace(profile, [
      {
        ruleId: 'SPEED-QUALITY-001',
        outcome: profile.healthBlocked
          ? 'REFER'
          : profile.limitations?.trim()
            ? 'MODIFY'
            : 'PROCEED',
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
  if (input.profile.healthBlocked) {
    throw new Error('UNSUPPORTED_PRESCRIPTION:HEALTH_ENGINE_NOT_AVAILABLE')
  }
  if (input.profile.age === undefined || input.profile.age < 18) {
    throw new Error('UNSUPPORTED_PRESCRIPTION:YOUTH_ENGINE_NOT_AVAILABLE')
  }
  if (input.kind === 'STRENGTH') {
    return prescribeStrength(
      input.sessionId,
      input.title,
      input.durationMinutes,
      input.profile,
    )
  }
  if (input.kind === 'SPEED_POWER' || input.kind === 'SPORT' || input.kind === 'MATCH') {
    throw new Error(`UNSUPPORTED_PRESCRIPTION:${input.kind}`)
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
  throw new Error(`UNSUPPORTED_PRESCRIPTION:${input.kind satisfies never}`)
}

function unsupportedPrescription(
  sessionKind: 'SPEED_POWER' | 'SPORT' | 'MATCH',
): UnsupportedPrescription {
  if (sessionKind === 'SPEED_POWER') {
    return {
      status: 'UNSUPPORTED',
      sessionKind,
      reasonCode: 'SPEED_POWER_ENGINE_NOT_REVIEWED',
      userMessage:
        'Automaattinen nopeus- ja teho-ohjelmointi ei ole vielä asiantuntijatarkastettu. Harjoitusta ei muodosteta väärän moottorin säännöillä.',
    }
  }
  if (sessionKind === 'MATCH') {
    return {
      status: 'UNSUPPORTED',
      sessionKind,
      reasonCode: 'MATCH_ENGINE_NOT_REVIEWED',
      userMessage:
        'Ottelu kirjataan kalenteriin ja kokonaiskuormaan, mutta Haukkari ei muodosta vielä automaattista otteluprescriptionia.',
    }
  }
  return {
    status: 'UNSUPPORTED',
    sessionKind,
    reasonCode: 'SPORT_ENGINE_NOT_REVIEWED',
    userMessage:
      'Lajiharjoitus kirjataan kalenteriin ja kokonaiskuormaan, mutta lajikohtainen automaattiohjelmointi ei ole vielä käytössä.',
  }
}

export function resolvePrescription(input: {
  sessionId: string
  title: string
  kind: SessionKind
  durationMinutes: number
  profile: PrescriptionProfile
}): PrescriptionResult {
  if (input.profile.healthBlocked) {
    return {
      status: 'UNSUPPORTED',
      sessionKind: input.kind,
      reasonCode: 'HEALTH_ENGINE_NOT_AVAILABLE',
      userMessage:
        'Automaattista prescriptionia ei muodosteta ilmoitetun terveysrajoitteen, raskauden tai selvittämättömän oireen perusteella. Noudata terveydenhuollon ammattilaisen yksilöllisiä ohjeita.',
    }
  }
  if (input.profile.age === undefined || input.profile.age < 18) {
    return {
      status: 'UNSUPPORTED',
      sessionKind: input.kind,
      reasonCode: 'YOUTH_ENGINE_NOT_AVAILABLE',
      userMessage:
        'Haukkarin automaattinen harjoitusmoottori on tässä versiossa tarkoitettu vähintään 18-vuotiaille. Junioriohjelmointi ei ole vielä käytössä.',
    }
  }
  if (input.kind === 'SPEED_POWER' || input.kind === 'SPORT' || input.kind === 'MATCH') {
    return unsupportedPrescription(input.kind)
  }
  return { status: 'SUPPORTED', prescription: prescribeSession(input) }
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
      while (sets > 1 && doseDurationSeconds({ ...dose, sets, targetRpe }) > maxSeconds) {
        sets -= 1
      }
      return withExerciseDose(exercise, {
        ...dose,
        sets,
        targetRpe,
        targetRir: light ? Math.min(5, (dose.targetRir ?? 2) + 1) : dose.targetRir,
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
    warmupMinutes: compact ? compactWarmupMinutes : normalized.warmupMinutes,
    warmup: compact
      ? [`${compactWarmupMinutes} min erittäin kevyesti ja hallitusti`]
      : normalized.warmup,
    exercises: selected,
    blocks: selected,
    cooldownMinutes: compact ? compactCooldownMinutes : normalized.cooldownMinutes,
    cooldown: compact
      ? [`${compactCooldownMinutes} min rauhallisesti ja hengityksen tasaus`]
      : normalized.cooldown,
    decisionTrace: {
      ...normalized.decisionTrace,
      safetyOutcome: light || compact ? 'MODIFY' : normalized.decisionTrace.safetyOutcome,
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
  prescribe: resolvePrescription,
  resolve: resolvePrescription,
  substitutions: exerciseSubstitutions,
}
