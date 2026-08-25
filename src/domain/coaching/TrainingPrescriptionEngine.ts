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
} from './types'

export const TRAINING_RULE_VERSION = '2026.08.25-v1'

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
  generatedAt?: string
}

type ExerciseTemplate = Omit<
  ExercisePrescription,
  | 'id'
  | 'sets'
  | 'repetitions'
  | 'durationSeconds'
  | 'restSeconds'
  | 'targetRpe'
  | 'targetRir'
  | 'loadGuidance'
  | 'loadType'
  | 'loadLabelFi'
  | 'loadOptions'
  | 'techniqueVideoUrl'
  | 'keyExercise'
>

const exerciseLibrary: ExerciseTemplate[] = [
  {
    code: 'CHAIR_SQUAT',
    nameFi: 'Tuolilta ylösnousu',
    category: 'Kyykky',
    equipment: ['Kehonpaino'],
    instructionsFi:
      'Pidä jalkapohjat maassa, nouse hallitusti ja kosketa tuolia kevyesti jokaisella toistolla.',
    stopCondition:
      'Lopeta, jos kipu voimistuu, tasapaino pettää tai tekniikka ei pysy hallittuna.',
    substitutions: ['Kehonpainokyykky', 'Maljakyykky'],
  },
  {
    code: 'GOBLET_SQUAT',
    nameFi: 'Maljakyykky',
    category: 'Kyykky',
    equipment: ['Käsipainot', 'Kahvakuula'],
    instructionsFi:
      'Pidä paino rinnan edessä, polvet varpaiden suuntaan ja käytä kivutonta liikerataa.',
    stopCondition: 'Lopeta, jos kipu voimistuu tai vartalon hallinta katoaa.',
    substitutions: ['Tuolilta ylösnousu', 'Jalkaprässi'],
  },
  {
    code: 'LEG_PRESS',
    nameFi: 'Jalkaprässi',
    category: 'Kyykky',
    equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Pidä alaselkä tuettuna ja työnnä polvet varpaiden suuntaan.',
    stopCondition: 'Lopeta, jos polvi- tai selkäkipu voimistuu.',
    substitutions: ['Maljakyykky', 'Tuolilta ylösnousu'],
  },
  {
    code: 'GLUTE_BRIDGE',
    nameFi: 'Lantionnosto',
    category: 'Lannesarana',
    equipment: ['Kehonpaino'],
    instructionsFi:
      'Paina jalkapohjat lattiaan, nosta lantio ilman alaselän yliojennusta ja laske rauhallisesti.',
    stopCondition: 'Lopeta, jos alaselkään tai takareiteen tulee terävää kipua.',
    substitutions: ['Romanialainen maastaveto', 'Bird dog'],
  },
  {
    code: 'ROMANIAN_DEADLIFT',
    nameFi: 'Romanialainen maastaveto',
    category: 'Lannesarana',
    equipment: ['Käsipainot', 'Kahvakuula', 'Levytanko ja painot'],
    instructionsFi:
      'Vie lantiota taakse, pidä kuorma lähellä vartaloa ja selkä hallitussa neutraaliasennossa.',
    stopCondition: 'Lopeta, jos selän asento ei pysy tai kipu voimistuu.',
    substitutions: ['Lantionnosto', 'Taljaveto jalkojen välistä'],
  },
  {
    code: 'ELEVATED_PUSH_UP',
    nameFi: 'Korotettu punnerrus',
    category: 'Työntö',
    equipment: ['Kehonpaino'],
    instructionsFi:
      'Tue kädet vakaalle tasolle, pidä vartalo suorana ja laske rinta hallitusti kohti tukea.',
    stopCondition: 'Lopeta, jos olkapääkipu voimistuu tai vartalon linja pettää.',
    substitutions: ['Punnerrus', 'Käsipainopenkkipunnerrus'],
  },
  {
    code: 'DUMBBELL_FLOOR_PRESS',
    nameFi: 'Käsipainopunnerrus lattialla',
    category: 'Työntö',
    equipment: ['Käsipainot'],
    instructionsFi:
      'Pidä ranteet suorina, laske olkavarret rauhallisesti lattiaan ja työnnä ilman kiirettä.',
    stopCondition: 'Lopeta, jos rintaan tai olkapäähän tulee poikkeavaa kipua.',
    substitutions: ['Korotettu punnerrus', 'Rintaprässi'],
  },
  {
    code: 'CHEST_PRESS',
    nameFi: 'Rintaprässi',
    category: 'Työntö',
    equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Säädä istuin, tue selkä ja työnnä kahvat hallitusti eteen.',
    stopCondition: 'Lopeta, jos olkapää- tai rintakipu voimistuu.',
    substitutions: ['Korotettu punnerrus', 'Käsipainopunnerrus lattialla'],
  },
  {
    code: 'PRONE_W_RAISE',
    nameFi: 'Vatsamakuun W-nosto',
    category: 'Veto',
    equipment: ['Kehonpaino'],
    instructionsFi:
      'Makaa vatsallasi, vedä kyynärpäät W-asentoon ja nosta käsiä vain vähän puristaen lapoja yhteen.',
    stopCondition: 'Lopeta, jos niska- tai olkapääkipu voimistuu.',
    substitutions: ['Soutu vastuskuminauhalla', 'Yhden käden soutu'],
  },
  {
    code: 'BAND_ROW',
    nameFi: 'Soutu vastuskuminauhalla',
    category: 'Veto',
    equipment: ['Vastuskuminauhat'],
    instructionsFi:
      'Kiinnitä nauha varmasti, vedä kyynärpäät kohti kylkiä ja palauta rauhallisesti.',
    stopCondition: 'Lopeta, jos kiinnitys liikkuu tai olkapääkipu voimistuu.',
    substitutions: ['Yhden käden soutu', 'Soutu laitteessa'],
  },
  {
    code: 'ONE_ARM_ROW',
    nameFi: 'Yhden käden soutu',
    category: 'Veto',
    equipment: ['Käsipainot', 'Kahvakuula'],
    instructionsFi:
      'Tue vapaa käsi, vedä kyynärpää kohti kylkeä ja vältä vartalon kiertoa.',
    stopCondition: 'Lopeta, jos selkä- tai olkapääkipu voimistuu.',
    substitutions: ['Soutu vastuskuminauhalla', 'Soutu laitteessa'],
  },
  {
    code: 'SEATED_ROW',
    nameFi: 'Soutu laitteessa',
    category: 'Veto',
    equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Pidä rintakehä ryhdikkäänä ja vedä kahvat kohti kylkiä.',
    stopCondition: 'Lopeta, jos olkapää- tai selkäkipu voimistuu.',
    substitutions: ['Yhden käden soutu', 'Soutu vastuskuminauhalla'],
  },
  {
    code: 'BIRD_DOG',
    nameFi: 'Bird dog',
    category: 'Keskivartalo',
    equipment: ['Kehonpaino'],
    instructionsFi:
      'Ojenna vastakkainen käsi ja jalka ilman lantion kiertoa. Pidä hengitys rauhallisena.',
    stopCondition: 'Lyhennä liikettä tai lopeta, jos alaselkäkipu voimistuu.',
    substitutions: ['Dead bug', 'Sivulankku polvet maassa'],
  },
  {
    code: 'DEAD_BUG',
    nameFi: 'Dead bug',
    category: 'Keskivartalo',
    equipment: ['Kehonpaino'],
    instructionsFi:
      'Pidä alaselkä hallittuna, hengitä ulos ojennuksen aikana ja käytä liikerataa, jonka hallitset.',
    stopCondition: 'Lyhennä liikettä tai lopeta, jos selkäkipu voimistuu.',
    substitutions: ['Bird dog', 'Sivulankku polvet maassa'],
  },
  {
    code: 'SPLIT_SQUAT',
    nameFi: 'Tuettu askelkyykky',
    category: 'Yhden jalan voima',
    equipment: ['Kehonpaino'],
    instructionsFi:
      'Ota tarvittaessa tukea, laskeudu suoraan alas ja pidä etummaisen jalan jalkapohja maassa.',
    stopCondition: 'Lopeta, jos tasapaino pettää tai polvikipu voimistuu.',
    substitutions: ['Tuolilta ylösnousu', 'Matala porrasnousu'],
  },
]

const bodyweightCodes = new Set([
  'CHAIR_SQUAT',
  'GLUTE_BRIDGE',
  'ELEVATED_PUSH_UP',
  'PRONE_W_RAISE',
  'BIRD_DOG',
  'DEAD_BUG',
  'SPLIT_SQUAT',
])

const techniqueVideos: Partial<Record<string, string>> = {
  GOBLET_SQUAT: 'https://www.youtube.com/watch?v=nfX7IFK9UNI',
  ROMANIAN_DEADLIFT: 'https://www.youtube.com/watch?v=H71kODJpFus',
  DUMBBELL_FLOOR_PRESS: 'https://www.youtube.com/watch?v=qHCI9rK7HqM',
  BIRD_DOG: 'https://www.youtube.com/watch?v=egKWoMZ6cXM',
}

function loadTracking(template: ExerciseTemplate): {
  loadType: ExerciseLoadType
  loadLabelFi: string
  loadOptions?: string[]
} {
  if (template.code === 'BAND_ROW') {
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
  if (template.code === 'DUMBBELL_FLOOR_PRESS' || template.code === 'ONE_ARM_ROW') {
    return { loadType: 'DUMBBELL_KG_EACH', loadLabelFi: 'Kuorma kg / käsipaino' }
  }
  return { loadType: 'EXTERNAL_KG', loadLabelFi: 'Kuorma kg' }
}

function hasEquipment(template: ExerciseTemplate, available: string[]) {
  return template.equipment.some(
    (item) => item === 'Kehonpaino' || available.includes(item),
  )
}

function chooseExercise(
  category: string,
  available: string[],
  dislikes: string,
  fallbackCode: string,
) {
  const candidates = exerciseLibrary
    .filter((item) => item.category === category && hasEquipment(item, available))
    .sort((left, right) => {
      const leftSpecific = left.equipment.some(
        (item) => item !== 'Kehonpaino' && available.includes(item),
      )
      const rightSpecific = right.equipment.some(
        (item) => item !== 'Kehonpaino' && available.includes(item),
      )
      return Number(rightSpecific) - Number(leftSpecific)
    })
  const preferred = candidates.find(
    (item) =>
      !dislikes.includes(item.nameFi.toLocaleLowerCase('fi-FI')) &&
      !dislikes.includes(item.category.toLocaleLowerCase('fi-FI')),
  )
  return (
    preferred ??
    candidates[0] ??
    exerciseLibrary.find((item) => item.code === fallbackCode) ??
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
  return {
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
  }
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
    techniqueVideoUrl: techniqueVideos[template.code],
    id: `${sessionId}-${template.code.toLocaleLowerCase('en-US')}`,
    sets,
    repetitions: parameters.repetitions,
    restSeconds: parameters.restSeconds,
    targetRpe,
    targetRir: Math.min(5, parameters.targetRir + (modified ? 1 : 0)),
    loadGuidance:
      'Valitse kuorma, jolla tavoitetoistot onnistuvat hallitusti ja sarjan lopussa jää ilmoitettu määrä hyviä toistoja varastoon.',
    keyExercise: index < 2,
  }
}

export function exerciseSubstitutions(
  exercise: ExercisePrescription,
  availableEquipment: string[],
): ExercisePrescription[] {
  return exercise.substitutions.flatMap((name) => {
    const template = exerciseLibrary.find((candidate) => candidate.nameFi === name)
    if (!template || !hasEquipment(template, availableEquipment)) return []
    return [
      {
        ...exercise,
        ...template,
        ...loadTracking(template),
        techniqueVideoUrl: techniqueVideos[template.code],
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
  const exercises = categories.map(([category, fallback], index) =>
    toPrescription(
      sessionId,
      chooseExercise(category, available, dislikes, fallback),
      index,
      parameters,
      profile,
    ),
  )
  const missingData = available.every((item) => item === 'Kehonpaino')
    ? [
        'Vetoliikkeen kuormitusväline puuttuu; käytössä on konservatiivinen kehonpainovaihtoehto.',
      ]
    : []
  return {
    id: sessionId,
    title,
    kind,
    goal: profile.goal,
    durationMinutes: Math.min(durationMinutes, profile.minutesPerSession),
    warmup: [
      '5 min rauhallista kävelyä tai muuta kevyttä sykettä nostavaa liikettä',
      '1 kevyt harjoitussarja päivän kahdesta ensimmäisestä liikkeestä',
    ],
    exercises,
    cooldown: ['3 min rauhallista liikettä ja hengityksen tasaus'],
    progression:
      'Kun kaikki sarjat osuvat toistoalueen yläpäähän samalla tai alemmalla RPE:llä kahdessa harjoituksessa, lisää pienin mahdollinen kuorma tai 1 toisto sarjaa kohti.',
    decisionTrace: decisionTrace(
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
    ),
  }
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
  const total = Math.min(durationMinutes, profile.minutesPerSession)
  const mode = aerobicMode(profile)
  const hardAllowed = !profile.healthBlocked && !profile.limitations?.trim()
  const interval = kind === 'INTERVAL' && hardAllowed
  const mainMinutes = Math.max(5, total - 10)
  const exercises: ExercisePrescription[] = [
    {
      id: `${sessionId}-main`,
      code: interval ? 'CONTROLLED_INTERVALS' : 'EASY_AEROBIC',
      nameFi: interval ? 'Hallitut intervallit' : 'Helppo peruskestävyys',
      category: 'Kestävyys',
      equipment: [],
      instructionsFi: interval
        ? `Tee ${mode} muodossa 4 × 3 min reippaasti (RPE 7), välissä 2 min erittäin kevyesti.`
        : `Tee ${mode} muodossa tasaisesti. Pystyt puhumaan kokonaisia lauseita koko työosuuden ajan.`,
      sets: interval ? 4 : 1,
      durationSeconds: mainMinutes * 60,
      restSeconds: interval ? 120 : 0,
      targetRpe: interval ? 7 : 4,
      loadGuidance: interval
        ? 'Ensimmäisen vedon pitää tuntua hallitulta; pidä kaikki vedot tasalaatuisina.'
        : 'Säädä vauhtia puhetestillä, ei oletetulla sykealueella.',
      stopCondition:
        'Lopeta ja hakeudu arvioon, jos ilmenee rintakipua, pyörtymisen tunnetta tai poikkeavaa hengenahdistusta.',
      substitutions: ['Kävely', 'Kuntopyörä', 'Vesiliikunta'],
      loadType: 'LEVEL',
      loadLabelFi: 'Vauhti tai vastustaso',
      keyExercise: true,
    },
  ]
  return {
    id: sessionId,
    title: interval ? title : 'Helppo peruskestävyys',
    kind: interval ? kind : 'EASY_ENDURANCE',
    goal: profile.goal,
    durationMinutes: total,
    warmup: ['5 min erittäin kevyesti; tehon pitää tuntua selvästi helpolta'],
    exercises,
    cooldown: ['5 min erittäin kevyesti ja hengityksen tasaus'],
    progression:
      'Lisää helppoon viikkokokonaisuuteen 5–10 minuuttia vasta, kun nykyinen määrä toteutuu ilman oireita ja palautuminen pysyy normaalina.',
    decisionTrace: decisionTrace(profile, [
      {
        ruleId: interval ? 'END-INTERVAL-001' : 'END-EASY-001',
        outcome: interval ? 'PROCEED' : kind === 'INTERVAL' ? 'MODIFY' : 'PROCEED',
        message: interval
          ? 'Intervallit ovat hallittuja, tasalaatuisia ja sisältävät aktiivisen palautuksen.'
          : kind === 'INTERVAL'
            ? 'Rajoite tai terveysesto muuttaa intervallin helpoksi peruskestävyydeksi.'
            : 'Peruskestävyys ohjataan puhetestillä ja koetulla kuormittavuudella.',
        evidenceIds: ['WHO-PA-2020', 'IOC-ARI-2022'],
      },
    ]),
  }
}

function prescribeMobility(
  sessionId: string,
  title: string,
  kind: SessionKind,
  durationMinutes: number,
  profile: PrescriptionProfile,
): PrescribedSession {
  const recovery = kind === 'RECOVERY'
  const items = [
    ['CAT_COW', 'Selän rauhallinen pyöristys ja ojennus', '6–8 rauhallista toistoa'],
    ['HIP_SHIFT', 'Lantion painonsiirto', '6–8 toistoa / puoli'],
    ['WALL_SLIDE', 'Lapojen seinäliuku', '6–10 toistoa'],
  ]
  return {
    id: sessionId,
    title,
    kind,
    goal: profile.goal,
    durationMinutes: Math.min(durationMinutes, profile.minutesPerSession),
    warmup: ['2 min rauhallista kävelyä ja hengityksen tasaus'],
    exercises: items.map(([code, nameFi, repetitions], index) => ({
      id: `${sessionId}-${code.toLocaleLowerCase('en-US')}`,
      code,
      nameFi,
      category: 'Liikkuvuus ja hallinta',
      equipment: ['Kehonpaino'],
      instructionsFi: 'Liiku hitaasti vain kivuttomalla ja hallitulla liikeradalla.',
      sets: 2,
      repetitions,
      restSeconds: 30,
      targetRpe: recovery ? 2 : 3,
      loadGuidance: 'Liikeradan laatu ratkaisee; älä lisää ulkoista kuormaa.',
      stopCondition:
        'Lopeta liike, jos kipu lisääntyy tai tulee puutumista tai huimausta.',
      substitutions: ['Rauhallinen kävely', 'Pienempi liikerata'],
      loadType: 'NONE',
      loadLabelFi: 'Ei ulkoista kuormaa',
      keyExercise: index === 0,
    })),
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
  }
}

export function prescribeSession(input: {
  sessionId: string
  title: string
  kind: SessionKind
  durationMinutes: number
  profile: PrescriptionProfile
}): PrescribedSession {
  if (input.kind === 'STRENGTH' || input.kind === 'SPEED_POWER') {
    return prescribeStrength(
      input.sessionId,
      input.title,
      input.kind,
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

  const compact = variant.kind.startsWith('COMPACT')
  const light = variant.kind === 'LIGHT' || readiness === 'YELLOW'
  const limit = compact ? compactExerciseLimit(variant.durationMinutes) : Infinity
  const compactWarmupMinutes =
    variant.durationMinutes <= 10 ? 2 : variant.durationMinutes <= 20 ? 3 : 5
  const compactCooldownMinutes =
    variant.durationMinutes <= 10 ? 1 : variant.durationMinutes <= 20 ? 2 : 5
  const compactWorkMinutes = Math.max(
    1,
    variant.durationMinutes - compactWarmupMinutes - compactCooldownMinutes,
  )
  const selected = [...prescription.exercises]
    .sort((left, right) => Number(right.keyExercise) - Number(left.keyExercise))
    .slice(0, limit)
    .map((exercise) => ({
      ...exercise,
      sets: compact
        ? Math.min(exercise.sets, variant.durationMinutes <= 20 ? 2 : 3)
        : light
          ? Math.max(1, Math.ceil(exercise.sets * 0.65))
          : exercise.sets,
      durationSeconds: exercise.durationSeconds
        ? Math.max(60, Math.min(exercise.durationSeconds, compactWorkMinutes * 60))
        : undefined,
      targetRpe: light ? Math.min(6, exercise.targetRpe) : exercise.targetRpe,
      targetRir:
        light && exercise.targetRir
          ? Math.min(5, exercise.targetRir + 1)
          : exercise.targetRir,
    }))

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

  return {
    ...prescription,
    title: compact
      ? `${prescription.title} · ${variant.durationMinutes} min`
      : prescription.title,
    durationMinutes: variant.durationMinutes,
    warmup: compact
      ? [`${compactWarmupMinutes} min erittäin kevyesti ja hallitusti`]
      : prescription.warmup,
    exercises: selected,
    cooldown: compact
      ? [`${compactCooldownMinutes} min rauhallisesti ja hengityksen tasaus`]
      : prescription.cooldown,
    decisionTrace: {
      ...prescription.decisionTrace,
      safetyOutcome:
        light || compact ? 'MODIFY' : prescription.decisionTrace.safetyOutcome,
      rules: [...prescription.decisionTrace.rules, adaptationRule],
    },
  }
}

export const TrainingPrescriptionEngine = {
  adapt: adaptPrescription,
  prescribe: prescribeSession,
  substitutions: exerciseSubstitutions,
}
