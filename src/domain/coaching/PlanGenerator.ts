import { optimizeSchedule } from './ScheduleOptimizer'
import { getSportAdapter } from './SportAdapterRegistry'
import { getGoalStrategy } from './strategies'
import { AthleteStateBuilder, ConstraintEngine, type AthleteState } from './engine'
import {
  adaptPrescription,
  resolvePrescription,
  TRAINING_RULE_VERSION,
  type PrescriptionProfile,
} from './TrainingPrescriptionEngine'
import type {
  CompetitionEvent,
  ConfirmedLimitationTag,
  ExplainableDecision,
  ExperienceLevel,
  GoalProfile,
  LoadRegion,
  PlannedSession,
  SessionIntensity,
  SessionKind,
  TrainingPlan,
  WorkoutVariant,
  VerifiedNextLoad,
} from './types'
import type { AdultResistanceSetHistory } from './AdultResistanceEngine'
import { applyHockeyMicrocycle } from './sports/iceHockeyAdapter'
import type { StrengthTrainingBackground } from './ReturnToStrengthPolicy'
import { evaluateStrengthReturn } from './ReturnToStrengthPolicy'
import {
  createStrengthWeekBlueprint,
  finalizeStrengthWeekPlan,
  initialStrengthWeekMaterializationState,
  materializeStrengthWeekSession,
  STRENGTH_WEEK_REASON_CODES,
  type StrengthWeekBlueprint,
} from './StrengthWeekPolicy'
import { calculatePlannedMuscleVolume } from './StrengthVolumePolicy'
import { createLocalCalendarContext } from './LocalCalendarPolicy'
import { ADULT_STRENGTH_TIME_POLICY } from './TimeBudgetPolicy'

export type PlanGenerationInput = {
  goal: GoalProfile
  experience: ExperienceLevel
  availableDays: number[]
  currentEnduranceMinutes: number
  fixedSessions: PlannedSession[]
  competitions: CompetitionEvent[]
  sportDiscipline?: string
  equipment?: string[]
  physicalLoad?: PrescriptionProfile['physicalLoad']
  minutesPerSession?: number
  minutesByDay?: Record<string, number>
  likes?: string
  dislikes?: string
  limitations?: string
  confirmedLimitationTags?: ConfirmedLimitationTag[]
  healthBlocked?: boolean
  enduranceBackgroundKnown?: boolean
  medicationAffectsHeartRate?: boolean
  hockeyBeta?: boolean
  age?: number
  generatedAt: string
  calendarTimeZone: string
  localDate: string
  /** Toteutunut, WorkoutRecord-tunnisteilla yksilöity voimaharjoitteluhistoria. */
  strengthHistory?: AdultResistanceSetHistory[]
  verifiedNextLoads?: VerifiedNextLoad[]
  strengthTrainingBackground?: StrengthTrainingBackground
  /** Maanantain ISO-päivä (YYYY-MM-DD), johon versionoitu viikkorakenne sidotaan. */
  weekAnchorDate: string
  /** Väliin jäänyt snapshot-harjoitus poistetaan ilman sarjojen takaisinmaksua. */
  missedSessionId?: string
  /** Jo toteutuneiden saman viikon blueprintien id:t; niitä ei suunnitella uudelleen. */
  completedStrengthSessionIds?: string[]
}

const sessionDefaults: Record<
  SessionKind,
  {
    title: string
    prescription: string[]
    durationMinutes: number
    intensity: SessionIntensity
    loadRegion: LoadRegion
  }
> = {
  STRENGTH: {
    title: 'Kokovartalon voima',
    prescription: [
      'Rauhallinen lämmittely',
      '4–6 moninivelliikettä',
      'Lopeta sarjat hyvällä tekniikalla',
    ],
    durationMinutes: 45,
    intensity: 'HARD',
    loadRegion: 'FULL_BODY',
  },
  EASY_ENDURANCE: {
    title: 'Helppo peruskestävyys',
    prescription: [
      'Aloita rauhallisesti',
      'Pidä vauhti keskustelutasolla',
      'Lopeta kevyellä jäähdyttelyllä',
    ],
    durationMinutes: 40,
    intensity: 'EASY',
    loadRegion: 'CARDIO',
  },
  INTERVAL: {
    title: 'Hallittu intervalli',
    prescription: [
      '10 min helppoa',
      '4–6 laadukasta työjaksoa',
      'Palauta rauhassa työjaksojen välissä',
    ],
    durationMinutes: 35,
    intensity: 'HARD',
    loadRegion: 'LOWER',
  },
  SPEED_POWER: {
    title: 'Nopeus ja teho',
    prescription: [
      'Huolellinen lämmittely',
      'Lyhyet laadukkaat suoritukset',
      'Lopeta ennen tekniikan hajoamista',
    ],
    durationMinutes: 35,
    intensity: 'HARD',
    loadRegion: 'LOWER',
  },
  MOBILITY: {
    title: 'Liikkuvuus ja hallinta',
    prescription: [
      'Hengitä rauhallisesti',
      'Liiku hallitulla alueella',
      'Älä pakota kipuun',
    ],
    durationMinutes: 10,
    intensity: 'EASY',
    loadRegion: 'NONE',
  },
  SPORT: {
    title: 'Lajiharjoitus',
    prescription: ['Noudata valmentajan harjoitusta', 'Kirjaa kesto ja kuormittavuus'],
    durationMinutes: 60,
    intensity: 'MODERATE',
    loadRegion: 'FULL_BODY',
  },
  MATCH: {
    title: 'Ottelu tai kilpailu',
    prescription: [
      'Noudata tapahtuman ja valmentajan ohjeita',
      'Varaa aikaa palautumiselle',
    ],
    durationMinutes: 90,
    intensity: 'HARD',
    loadRegion: 'FULL_BODY',
  },
  RECOVERY: {
    title: 'Palauttava liike',
    prescription: ['Pidä teho erittäin kevyenä', 'Lopeta, jos olo heikkenee'],
    durationMinutes: 20,
    intensity: 'EASY',
    loadRegion: 'NONE',
  },
  REST: {
    title: 'Lepopäivä',
    prescription: ['Anna keholle aikaa palautua'],
    durationMinutes: 0,
    intensity: 'EASY',
    loadRegion: 'NONE',
  },
}

function createWorkoutVariants(durationMinutes: number): WorkoutVariant[] {
  return [
    {
      kind: 'FULL',
      timeBudgetMinutes: durationMinutes,
      durationMinutes,
      volumeMultiplier: 1,
    },
    {
      kind: 'LIGHT',
      timeBudgetMinutes: durationMinutes,
      durationMinutes,
      volumeMultiplier: 0.65,
    },
    {
      kind: 'COMPACT_10',
      timeBudgetMinutes: Math.min(durationMinutes, 10),
      durationMinutes: Math.min(durationMinutes, 10),
      volumeMultiplier: 0.35,
    },
    {
      kind: 'COMPACT_20',
      timeBudgetMinutes: Math.min(durationMinutes, 20),
      durationMinutes: Math.min(durationMinutes, 20),
      volumeMultiplier: 0.55,
    },
    {
      kind: 'COMPACT_30',
      timeBudgetMinutes: Math.min(durationMinutes, 30),
      durationMinutes: Math.min(durationMinutes, 30),
      volumeMultiplier: 0.75,
    },
  ]
}

function createAppSessions(
  input: PlanGenerationInput,
  athleteState: AthleteState,
  strengthWeek?: StrengthWeekBlueprint,
) {
  const strategy = getGoalStrategy(input.goal.primary)
  const sessions: PlannedSession[] = []
  const occupiedDays = new Set(
    input.fixedSessions.filter((session) => session.fixed).map((session) => session.day),
  )
  for (const competition of input.competitions) occupiedDays.add(competition.day)
  const openDays = [...new Set(input.availableDays)].filter(
    (day) => !occupiedDays.has(day),
  )
  const remaining = new Map<SessionKind, number>()
  for (const [kindValue, range] of Object.entries(strategy.weeklyStructure)) {
    if (!range) continue
    const kind = kindValue as SessionKind
    const fixedCount = input.fixedSessions.filter(
      (session) => session.kind === kind,
    ).length
    remaining.set(
      kind,
      kind === 'STRENGTH' && strengthWeek
        ? strengthWeek.appSessionCount
        : Math.max(0, range.min - fixedCount),
    )
  }
  const orderedKinds = [
    ...strategy.keyWorkouts,
    ...[...remaining.keys()].filter((kind) => !strategy.keyWorkouts.includes(kind)),
  ]
  const produced = new Map<SessionKind, number>()
  const pushNextSession = (kind: SessionKind) => {
    const count = remaining.get(kind) ?? 0
    if (count <= 0 || sessions.length >= openDays.length) return false
    const index = (produced.get(kind) ?? 0) + 1
    const defaults = sessionDefaults[kind]
    const day = openDays[sessions.length] ?? 1
    const recommendedDuration = ConstraintEngine.capSessionMinutes(
      athleteState,
      day,
      defaults.durationMinutes,
    )
    sessions.push({
      id: `generated-${kind.toLocaleLowerCase('fi-FI')}-${index}`,
      day,
      kind,
      title: defaults.title,
      prescription: defaults.prescription,
      durationMinutes: recommendedDuration,
      ...(kind === 'STRENGTH' ? { timeBudgetMinutes: recommendedDuration } : {}),
      intensity: defaults.intensity,
      loadRegion: defaults.loadRegion,
      fixed: false,
      source: 'APP',
      isNewStimulus: true,
      notes: [],
      variants: createWorkoutVariants(recommendedDuration),
    })
    produced.set(kind, index)
    remaining.set(kind, count - 1)
    return true
  }
  // Voimatavoitteen versionoitu viikkorakenne materialisoidaan ensin. Näin
  // muiden tavoitteiden minimimäärä ei hiljaisesti pudota A/B/C-jaksoa.
  while (strengthWeek && pushNextSession('STRENGTH')) {
    // Tyhjä runko: pushNextSession rajaa määrän ja käytettävissä olevat päivät.
  }
  while (sessions.length < openDays.length) {
    let added = false
    for (const kind of orderedKinds) {
      if (pushNextSession(kind)) added = true
    }
    if (!added) break
  }
  return sessions
}

function desiredAppSessionCount(input: PlanGenerationInput) {
  const strategy = getGoalStrategy(input.goal.primary)
  return Object.entries(strategy.weeklyStructure).reduce((total, [kindValue, range]) => {
    if (!range) return total
    const fixedCount = input.fixedSessions.filter(
      (session) => session.kind === (kindValue as SessionKind),
    ).length
    return total + Math.max(0, range.min - fixedCount)
  }, 0)
}

function distributeCurrentEnduranceVolume(
  sessions: PlannedSession[],
  currentEnduranceMinutes: number,
  minutesPerSession = 90,
  minutesByDay?: Record<string, number>,
) {
  const enduranceSessions = sessions.filter(
    (session) => session.kind === 'EASY_ENDURANCE' || session.kind === 'INTERVAL',
  )
  if (enduranceSessions.length === 0 || currentEnduranceMinutes <= 0) return 0
  let remainingMinutes = currentEnduranceMinutes
  for (const [index, session] of enduranceSessions.entries()) {
    const remainingSessions = enduranceSessions.length - index
    const requestedMinutes = Math.ceil(remainingMinutes / remainingSessions)
    const dayMaximum = Math.max(
      1,
      minutesByDay?.[String(session.day)] ?? minutesPerSession,
    )
    session.durationMinutes = Math.min(requestedMinutes, dayMaximum)
    session.variants = createWorkoutVariants(session.durationMinutes)
    remainingMinutes = Math.max(0, remainingMinutes - session.durationMinutes)
  }
  return remainingMinutes
}

export function generatePlan(
  input: PlanGenerationInput,
): ExplainableDecision<TrainingPlan> {
  if (input.availableDays.length === 0) {
    throw new Error(
      'Ohjelman muodostaminen vaatii vähintään yhden käytettävissä olevan päivän.',
    )
  }
  const calendar = createLocalCalendarContext(input.generatedAt, input.calendarTimeZone)
  if (
    calendar.localDate !== input.localDate ||
    calendar.weekAnchorDate !== input.weekAnchorDate
  ) {
    throw new Error('INCONSISTENT_LOCAL_CALENDAR_CONTEXT')
  }

  const strategy = getGoalStrategy(input.goal.primary)
  const athleteState = AthleteStateBuilder.build(input)
  const fixedStrengthSessions = input.fixedSessions.filter(
    (session) => session.kind === 'STRENGTH',
  )
  const occupiedDays = new Set(
    input.fixedSessions.filter((session) => session.fixed).map((session) => session.day),
  )
  for (const competition of input.competitions) occupiedDays.add(competition.day)
  const availableAppDays = [...new Set(input.availableDays)].filter(
    (day) => !occupiedDays.has(day),
  ).length
  const strengthReturn = evaluateStrengthReturn({
    history: input.strengthHistory ?? [],
    generatedAt: input.generatedAt,
    background: input.strengthTrainingBackground,
  })
  const generatedAtForWeek = input.generatedAt
  const backgroundLastAt = input.strengthTrainingBackground?.lastStrengthWorkoutAt
  const confirmedBackgroundAgeDays = backgroundLastAt
    ? (Date.parse(generatedAtForWeek) - Date.parse(backgroundLastAt)) / 86_400_000
    : Number.POSITIVE_INFINITY
  const strengthWeekEligibleGoal = [
    'GENERAL_FITNESS',
    'MAX_STRENGTH',
    'MUSCLE_GAIN',
    'BODY_RECOMPOSITION',
    'FAT_LOSS',
  ].includes(input.goal.primary)
  const strengthWeek =
    strategy.weeklyStructure.STRENGTH && strengthWeekEligibleGoal
      ? createStrengthWeekBlueprint({
          weekAnchorDate: input.weekAnchorDate,
          goal: input.goal.primary,
          experience: input.experience,
          availableAppDays,
          fixedStrengthExposureCount: fixedStrengthSessions.length,
          fixedStrengthVolumeKnown: fixedStrengthSessions.every(
            (session) => session.prescriptionDetail?.kind === 'STRENGTH',
          ),
          returning:
            strengthReturn.state !== 'ACTIVE' &&
            strengthReturn.state !== 'NOVICE_COLD_START',
          equipment: athleteState.longTerm.equipment,
          history: input.strengthHistory ?? [],
          trainingContinuityConfirmed:
            strengthReturn.state === 'ACTIVE' ||
            (input.strengthTrainingBackground?.regularTrainingAtLeast12Weeks === true &&
              confirmedBackgroundAgeDays >= 0 &&
              confirmedBackgroundAgeDays <= 7),
          generatedAt: input.generatedAt,
        })
      : undefined
  const allAppSessions = createAppSessions(input, athleteState, strengthWeek)
  const strengthRoleIndexBySessionId = new Map(
    allAppSessions
      .filter((session) => session.kind === 'STRENGTH')
      .map((session, index) => [session.id, index] as const),
  )
  const completedStrengthSessionIds = new Set(input.completedStrengthSessionIds ?? [])
  const appSessions = allAppSessions.filter(
    (session) =>
      session.kind !== 'STRENGTH' || !completedStrengthSessionIds.has(session.id),
  )
  let unallocatedEnduranceMinutes = 0
  if (input.goal.primary === 'ENDURANCE') {
    const fixedEnduranceMinutes = input.fixedSessions
      .filter(
        (session) => session.kind === 'EASY_ENDURANCE' || session.kind === 'INTERVAL',
      )
      .reduce((total, session) => total + session.durationMinutes, 0)
    unallocatedEnduranceMinutes = distributeCurrentEnduranceVolume(
      appSessions,
      Math.max(0, input.currentEnduranceMinutes - fixedEnduranceMinutes),
      athleteState.schedule.defaultMaximumMinutes,
      athleteState.schedule.maximumMinutesByDay,
    )
  }

  const competitionSessions: PlannedSession[] = input.competitions.map((competition) => ({
    id: `competition-${competition.id}`,
    day: competition.day,
    kind: 'MATCH',
    durationMinutes: 90,
    intensity: 'HARD',
    loadRegion: 'FULL_BODY',
    fixed: true,
    source: 'COMPETITION',
    notes: [`${competition.priority}-tapahtuma: ${competition.name}`],
  }))
  const optimization = optimizeSchedule({
    sessions: [...input.fixedSessions, ...competitionSessions, ...appSessions],
    competitions: input.competitions,
    allowedDays: input.availableDays,
    missedSessionId: input.missedSessionId,
  })
  const hockeyAdjustment =
    input.hockeyBeta && input.sportDiscipline === 'ice-hockey-adult-amateur-skater'
      ? applyHockeyMicrocycle(optimization.decision)
      : { sessions: optimization.decision, messages: [] }
  const profile: PrescriptionProfile = {
    goal: input.goal.primary,
    experience: input.experience,
    equipment: athleteState.longTerm.equipment,
    physicalLoad: athleteState.acute.physicalLoad,
    minutesPerSession: athleteState.schedule.defaultMaximumMinutes,
    likes: input.likes,
    dislikes: input.dislikes,
    limitations: input.limitations,
    confirmedLimitationTags: input.confirmedLimitationTags,
    healthBlocked: athleteState.acute.healthBlocked,
    enduranceBackgroundKnown: input.enduranceBackgroundKnown,
    medicationAffectsHeartRate: input.medicationAffectsHeartRate,
    age: input.age,
    generatedAt: input.generatedAt,
    // Viikkosuunnitelma on esikatselu; aktiivinen harjoitus portitetaan uudelleen
    // samana päivänä tallennetulla kuntotarkistuksella.
    readiness: 'GREEN',
    strengthHistory: input.strengthHistory,
    verifiedNextLoads: input.verifiedNextLoads,
    strengthTrainingBackground: input.strengthTrainingBackground,
  }
  let strengthSequenceIndex = 0
  let strengthWeekState = initialStrengthWeekMaterializationState(strengthWeek)
  const unsupportedStrengthSessionReasons: string[] = []
  for (const fixedSession of fixedStrengthSessions) {
    if (fixedSession.prescriptionDetail?.kind !== 'STRENGTH') continue
    const fixedVolume = calculatePlannedMuscleVolume(
      fixedSession.prescriptionDetail.exercises,
    )
    for (const [muscle, amount] of Object.entries(fixedVolume)) {
      strengthWeekState.plannedVolume[muscle] =
        (strengthWeekState.plannedVolume[muscle] ?? 0) + amount
    }
  }
  const prescribedSessions = hockeyAdjustment.sessions.map((session) => {
    if (session.source !== 'APP') return session
    const strengthRole =
      session.kind === 'STRENGTH'
        ? strengthWeek?.roles[
            strengthRoleIndexBySessionId.get(session.id) ?? strengthSequenceIndex
          ]
        : undefined
    if (session.kind === 'STRENGTH' && strengthWeek?.bodyweightPullUnsupported) {
      const safetyResolution = resolvePrescription({
        sessionId: session.id,
        title: session.title ?? sessionDefaults[session.kind].title,
        kind: session.kind,
        durationMinutes: session.timeBudgetMinutes ?? session.durationMinutes,
        profile: {
          ...profile,
          strengthWeekRole: strengthRole,
          minutesPerSession:
            input.minutesByDay?.[String(session.day)] ?? profile.minutesPerSession,
        },
      })
      if (safetyResolution.status === 'UNSUPPORTED') {
        unsupportedStrengthSessionReasons.push(safetyResolution.reasonCode)
        strengthSequenceIndex += 1
        return { ...session, unsupportedPrescription: safetyResolution }
      }
      unsupportedStrengthSessionReasons.push(
        STRENGTH_WEEK_REASON_CODES.PULL_EQUIPMENT_REQUIRED,
      )
      strengthSequenceIndex += 1
      return {
        ...session,
        title: 'Voimaharjoitus – vetävä liikesuunta tarvitsee välineen',
        unsupportedPrescription: {
          status: 'UNSUPPORTED' as const,
          sessionKind: 'STRENGTH' as const,
          reasonCode: 'PULL_PATTERN_EQUIPMENT_REQUIRED' as const,
          userMessage:
            'Tuettua koko viikon voimaharjoittelua ei muodosteta pelkällä kehonpainolla. Lisää pitkä vastuskuminauha tai muu tuettu vetoväline.',
        },
      }
    }
    const resolved = resolvePrescription({
      sessionId: session.id,
      title: session.title ?? sessionDefaults[session.kind].title,
      kind: session.kind,
      durationMinutes: session.timeBudgetMinutes ?? session.durationMinutes,
      profile: {
        ...profile,
        strengthWeekRole: strengthRole,
        minutesPerSession:
          input.minutesByDay?.[String(session.day)] ?? profile.minutesPerSession,
      },
    })
    if (resolved.status !== 'SUPPORTED') {
      if (session.kind === 'STRENGTH') {
        unsupportedStrengthSessionReasons.push(resolved.reasonCode)
        strengthSequenceIndex += 1
      }
      return { ...session, unsupportedPrescription: resolved }
    }
    if (resolved.prescription.kind !== 'STRENGTH') {
      return { ...session, prescriptionDetail: resolved.prescription }
    }
    if (!strengthWeek || !strengthRole) {
      return { ...session, prescriptionDetail: resolved.prescription }
    }
    let materialized
    try {
      materialized = materializeStrengthWeekSession({
        prescription: resolved.prescription,
        blueprint: strengthWeek,
        state: strengthWeekState,
        sequenceIndex:
          strengthRoleIndexBySessionId.get(session.id) ?? strengthSequenceIndex,
        history: input.strengthHistory ?? [],
      })
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'TIME_MINIMUM_SAFE_DOSE_UNAVAILABLE' ||
          error.message === 'NO_SAFE_STRENGTH_DOSE_AVAILABLE')
      ) {
        unsupportedStrengthSessionReasons.push(STRENGTH_WEEK_REASON_CODES.NO_SAFE_SESSION)
        strengthSequenceIndex += 1
        return {
          ...session,
          unsupportedPrescription: {
            status: 'UNSUPPORTED' as const,
            sessionKind: 'STRENGTH' as const,
            reasonCode: 'NO_SAFE_STRENGTH_DOSE_AVAILABLE' as const,
            userMessage:
              'Seitsemän vuorokauden volyymikattoon ja aikabudjettiin ei mahdu turvallista lisäannosta.',
          },
        }
      }
      throw error
    }
    strengthWeekState = materialized.state
    strengthSequenceIndex += 1
    const variants = (session.variants ?? []).flatMap((variant) => {
      const adapted = adaptPrescription(materialized.prescription, variant, {
        age: profile.age,
        readiness: 'GREEN',
        healthBlocked: Boolean(profile.healthBlocked),
        safetyInformationComplete: true,
      })
      if (adapted.status !== 'SUPPORTED') return []
      return [
        {
          ...variant,
          timeBudgetMinutes: variant.timeBudgetMinutes ?? variant.durationMinutes,
          durationMinutes: adapted.prescription.durationMinutes,
        },
      ]
    })
    return {
      ...session,
      title: strengthWeek.bodyweightPullUnsupported
        ? 'Voimaharjoitus – vetävä liikesuunta puuttuu'
        : session.title,
      durationMinutes: materialized.prescription.durationMinutes,
      prescriptionDetail: materialized.prescription,
      strengthWeekContext: materialized.context,
      notes: [
        ...(session.notes ?? []),
        ...(strengthWeek.bodyweightPullUnsupported
          ? [
              'Täysi kotivoimaohjelma tarvitsee vetoliikettä varten vähintään pitkän vastuskuminauhan tai muun Haukkarin tukeman välineen.',
            ]
          : []),
      ],
      variants,
    }
  })

  const assessments =
    input.goal.primary === 'MAX_STRENGTH' && input.experience === 'BEGINNER'
      ? ['Submaksimaalinen tekniikka- ja toistotesti', 'e1RM-arvio sarjasta']
      : strategy.metrics
  const reasons: ExplainableDecision<TrainingPlan>['reasons'] = [
    {
      code: 'PRIMARY_GOAL_STRATEGY',
      message: `Viikkorakenne perustuu päätavoitteeseen: ${strategy.label}.`,
      priority: 'PRIMARY_GOAL',
    },
    ...optimization.reasons,
  ]
  const warnings = [...optimization.warnings]
  for (const message of hockeyAdjustment.messages) {
    reasons.push({
      code: 'ICE_HOCKEY_MICROCYCLE_BETA',
      message,
      priority: 'COACH_FIXED',
    })
  }

  if (appSessions.length < desiredAppSessionCount(input)) {
    reasons.push({
      code: 'PLAN_FITS_AVAILABLE_DAYS',
      message:
        'Viikko on rajattu yhteen sovelluksen harjoitukseen käytettävissä olevaa päivää kohti; puuttuvaa määrää ei kasata samalle päivälle.',
      priority: 'TIME',
    })
    warnings.push(
      'Kaikki tavoitteen tavalliset viikkoärsykkeet eivät mahdu valituille päiville. Lisää harjoituspäiviä vain, jos se sopii arkeesi.',
    )
  }

  if (input.goal.primary === 'ENDURANCE') {
    reasons.push({
      code: 'ENDURANCE_STARTS_FROM_CURRENT_VOLUME',
      message: `Kestävyysviikko alkaa nykyisestä ${input.currentEnduranceMinutes} minuutin viikkomäärästä.`,
      priority: 'PRIMARY_GOAL',
    })
    if (unallocatedEnduranceMinutes > 0) {
      reasons.push({
        code: 'ENDURANCE_VOLUME_CAPPED_BY_AVAILABLE_TIME',
        message: `Nykyisestä viikkomäärästä ${unallocatedEnduranceMinutes} minuuttia ei mahdu turvallisesti valituille päiville ja päiväkohtaisiin aikarajoihin.`,
        priority: 'TIME',
      })
      warnings.push(
        'Viikkovolyymia ei kasata yhteen liian pitkään harjoitukseen. Lisää aikaa tai päiviä, jos haluat säilyttää koko nykyisen määrän.',
      )
    }
  }

  if (input.goal.primary === 'MAX_STRENGTH' && input.experience === 'BEGINNER') {
    reasons.push({
      code: 'NO_BEGINNER_ONE_REP_MAX_TEST',
      message: 'Aloittelijalle ei ohjelmoida yhden toiston maksimitestiä.',
      priority: 'SAFETY',
    })
  }

  if (strengthWeek?.bodyweightPullUnsupported) {
    reasons.push({
      code: STRENGTH_WEEK_REASON_CODES.PULL_EQUIPMENT_REQUIRED,
      message:
        'Täysi kotivoimaohjelma tarvitsee vetoliikettä varten vähintään pitkän vastuskuminauhan tai muun Haukkarin tukeman välineen.',
      priority: 'TIME',
    })
  }
  if (strengthWeek?.externalStrengthVolumeUnknown) {
    reasons.push({
      code: STRENGTH_WEEK_REASON_CODES.EXTERNAL_VOLUME_UNKNOWN,
      message:
        'Ulkopuolinen voimaharjoitus lasketaan harjoituskerraksi, mutta sarjaprogressio pidätetään, koska sen lihas- ja sarjatietoja ei tunneta.',
      priority: 'COACH_FIXED',
    })
  }

  if (input.goal.primary === 'SPORT_PERFORMANCE' || input.sportDiscipline) {
    const match = getSportAdapter(input.sportDiscipline ?? '', {
      hockeyBeta: input.hockeyBeta,
    })
    reasons.push({
      code:
        match.supportLevel === 'FULL' ? 'FULL_SPORT_ADAPTER' : 'GENERAL_SPORT_SUPPORT',
      message:
        match.supportLevel === 'FULL'
          ? `${match.adapter.id}-lajisovitin huomioi lajivaatimukset ja kiinteän lajikuorman.`
          : 'Lajille ei ole testattua täyttä lajisovitinta, joten käytössä on vain yleinen fysiikkatuki.',
      priority: 'COACH_FIXED',
    })
    if (match.adapter.warning) warnings.push(match.adapter.warning)
  }

  const strengthSessions = prescribedSessions.filter(
    (session) => session.source === 'APP' && session.kind === 'STRENGTH',
  )
  const maximumRemainingStrengthTimeSeconds = strengthSessions.reduce(
    (maximum, session) => {
      const budgetSeconds = (session.timeBudgetMinutes ?? session.durationMinutes) * 60
      const usedSeconds = session.prescriptionDetail?.calculatedTotalSeconds ?? 0
      return Math.max(maximum, Math.max(0, budgetSeconds - usedSeconds))
    },
    0,
  )
  const minimumPolicyAdditionSubtotal =
    ADULT_STRENGTH_TIME_POLICY.workSetSeconds +
    ADULT_STRENGTH_TIME_POLICY.transitionSeconds +
    Math.min(...Object.values(ADULT_STRENGTH_TIME_POLICY.equipmentSetupSeconds))
  const minimumPolicyAdditionSeconds =
    minimumPolicyAdditionSubtotal +
    Math.ceil(minimumPolicyAdditionSubtotal * ADULT_STRENGTH_TIME_POLICY.bufferRatio)
  const finalizedStrengthWeek = strengthWeek
    ? finalizeStrengthWeekPlan(strengthWeek, strengthWeekState, {
        unsupportedSessionReasons: unsupportedStrengthSessionReasons,
        expectedMaterializedSessionCount: strengthSessions.length,
        remainingTimeSeconds: maximumRemainingStrengthTimeSeconds,
        minimumPolicyAdditionSeconds,
      })
    : undefined

  return {
    decision: {
      goal: input.goal.primary,
      sessions: prescribedSessions,
      startingEnduranceMinutes:
        input.goal.primary === 'ENDURANCE' ? input.currentEnduranceMinutes : 0,
      assessments,
      ruleVersion: TRAINING_RULE_VERSION,
      ...(finalizedStrengthWeek
        ? {
            strengthWeek: {
              ...finalizedStrengthWeek,
              reasonCodes: [
                ...new Set([
                  ...finalizedStrengthWeek.reasonCodes,
                  ...(input.missedSessionId
                    ? [STRENGTH_WEEK_REASON_CODES.MISSED_SESSION_NOT_DOUBLED]
                    : []),
                ]),
              ],
            },
          }
        : {}),
    },
    reasons,
    warnings,
  }
}

export const PlanGenerator = { generate: generatePlan }
