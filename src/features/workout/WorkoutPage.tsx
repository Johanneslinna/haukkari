import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  adaptNextSet,
  applyWorkoutProgression,
  doseLabelFi,
  doseUnitCount,
  estimateExerciseCapability,
  exerciseSubstitutions,
  evaluateWorkoutFeedback,
  legacyDose,
  normalizePrescriptionV2,
  resolvePrescription,
  refreshAdultResistanceProgression,
  refreshStrengthPrescriptionTimeEstimate,
  strengthTrainingBackgroundFrom,
  verifiedNextLoadsFrom,
  type CompletedSet,
  type ExercisePrescription,
  type PrescribedSession,
  type PrescriptionResult,
  type WorkoutCompletionStatus,
  type WorkoutFeedback,
  type WorkoutProgressionDecision,
  type WorkoutVariant,
  type SetPainResponse,
} from '../../domain/coaching'
import { localCalendarDate } from '../../domain/coaching/LocalCalendarPolicy'
import type { LocalRecord } from '../../domain/sync/types'
import { useAppData } from '../app-data/appDataContextValue'
import {
  activeGoalRecord,
  activeTrainingPlan,
  completeWorkout,
  confirmNextAvailableLoad,
  saveWorkoutAdaptation,
  saveWorkoutSet,
  startWorkout,
} from '../coaching/coachingActions'
import {
  objectValue,
  calendarContextForProfile,
  numberValue,
  planSessions,
  readinessLabels,
  sessionLabels,
  stringValue,
} from '../coaching/coachingData'
import { canResumeWorkout, isLockedSafetyOutcome } from './WorkoutSafetyState'
import {
  adaptWorkoutPrescriptionForCurrentAthlete,
  authorizeWorkoutPrescriptionForCurrentAthlete,
  confirmedLimitationTags,
  currentWorkoutSafetyContext,
  storedReadiness,
} from './WorkoutPrescriptionAdapter'
import { strengthHistoryFromLogs } from './WorkoutHistory'
import {
  mayPrefillPreviousLoad,
  requestsNextLoadConfirmation,
} from './WorkoutProgressionUi'

const variantLabels: Record<WorkoutVariant['kind'], string> = {
  FULL: 'Täysi',
  LIGHT: 'Kevennetty',
  COMPACT_10: '10 min',
  COMPACT_20: '20 min',
  COMPACT_30: '30 min',
}

type EditableSet = CompletedSet & {
  repetitionsInput: string
  loadInput: string
  rirInput: string
  painInput: SetPainResponse | ''
  techniqueInput: 'OK' | 'DEGRADED' | ''
}

function savedPrescription(record: LocalRecord | null) {
  if (!record) return null
  const value = objectValue(record.data.prescription)
  if (
    typeof value.id !== 'string' ||
    (!Array.isArray(value.exercises) && !Array.isArray(value.blocks))
  ) {
    return null
  }
  const legacy = value as unknown as PrescribedSession
  return normalizePrescriptionV2({
    ...legacy,
    exercises: Array.isArray(value.exercises) ? legacy.exercises : (legacy.blocks ?? []),
  })
}

function usesStrengthLog(exercise: ExercisePrescription) {
  return legacyDose(exercise).kind === 'STRENGTH_SETS'
}

function doseUnitLabel(exercise: ExercisePrescription, count: number) {
  const dose = legacyDose(exercise)
  if (dose.kind === 'INTERVAL_BLOCKS' || dose.kind === 'SPRINT_REPS') {
    return `Veto ${count}`
  }
  if (dose.kind === 'CONTINUOUS_TIME') return 'Työosuus'
  if (dose.kind === 'SKILL_DRILL') return `Osuus ${count}`
  return `Sarja ${count}`
}

function repetitionRangeMaximum(exercise: ExercisePrescription) {
  const values = exercise.repetitions?.match(/\d+/gu)?.map(Number) ?? []
  return values.length > 0 ? Math.max(...values) : null
}

function createSetRows(
  prescription: PrescribedSession | null,
  persistedSets: LocalRecord[] = [],
  previousResults: WorkoutFeedback['exerciseResults'] = [],
): EditableSet[] {
  if (!prescription) return []
  return prescription.exercises.flatMap((exercise) =>
    Array.from({ length: doseUnitCount(exercise) }, (_, index) => {
      const setNumber = index + 1
      const persisted = persistedSets.find((record) => {
        const details = objectValue(record.data.data)
        return details.exercise_id === exercise.id && details.set_number === setNumber
      })
      const details = objectValue(persisted?.data.data)
      const previous = previousResults?.find(
        (result) =>
          result.exerciseCode === exercise.code &&
          exercise.contentVersion !== undefined &&
          result.exerciseVersion === exercise.contentVersion,
      )
      const repetitions =
        typeof persisted?.data.repetitions === 'number'
          ? persisted.data.repetitions
          : (previous?.repetitions[index] ?? null)
      const loadKg =
        typeof persisted?.data.load_kg === 'number' ? persisted.data.load_kg : null
      const previousLoad = previous?.loads[index] ?? null
      const persistedLoad =
        typeof details.load_text === 'string'
          ? details.load_text
          : loadKg === null
            ? null
            : String(loadKg)
      const suggestedLoad = persisted
        ? persistedLoad
        : exercise.progressionDecision?.action === 'INCREASE_LOAD' &&
            exercise.progressionDecision.nextLoadKg !== undefined
          ? String(exercise.progressionDecision.nextLoadKg).replace('.', ',')
          : !mayPrefillPreviousLoad(exercise)
            ? null
            : previousLoad
      const suggestedRepetitions =
        !persisted &&
        exercise.progressionDecision?.action === 'INCREASE_REPETITIONS' &&
        exercise.progressionDecision.nextRepetitions !== undefined
          ? exercise.progressionDecision.nextRepetitions
          : !persisted && exercise.progressionDecision?.action === 'INCREASE_LOAD'
            ? repetitionRangeMaximum(exercise)
            : repetitions
      const rir =
        typeof persisted?.data.rir === 'number'
          ? persisted.data.rir
          : (previous?.rirs?.[index] ?? null)
      const persistedPain =
        typeof details.pain_response === 'string'
          ? (details.pain_response as SetPainResponse)
          : ''
      const persistedTechnique =
        typeof details.technique_ok === 'boolean'
          ? details.technique_ok
            ? 'OK'
            : 'DEGRADED'
          : ''
      return {
        exerciseId: exercise.id,
        setNumber,
        repetitions: suggestedRepetitions,
        loadKg,
        loadText: suggestedLoad,
        rir,
        completed: persisted ? details.completed === true : false,
        repetitionsInput:
          suggestedRepetitions === null ? '' : String(suggestedRepetitions),
        loadInput: suggestedLoad ?? '',
        rirInput: rir === null ? '' : String(rir),
        painInput: persistedPain,
        techniqueInput: persistedTechnique,
      }
    }),
  )
}

function numericLoad(exercise: ExercisePrescription, value: string) {
  if (
    exercise.loadType !== 'EXTERNAL_KG' &&
    exercise.loadType !== 'DUMBBELL_KG_EACH' &&
    exercise.loadType !== 'MACHINE_KG'
  ) {
    return null
  }
  return parseOptionalNumber(value)
}

function parseOptionalNumber(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function savedFeedback(record: LocalRecord) {
  const value = objectValue(record.data.feedback)
  return typeof value.sessionRpe === 'number'
    ? (value as unknown as WorkoutFeedback)
    : null
}

function StrengthReturnNotice({ prescription }: { prescription: PrescribedSession }) {
  const decision = prescription.decisionTrace.strengthReturn
  if (
    !decision ||
    decision.state === 'ACTIVE' ||
    decision.state === 'NOVICE_COLD_START'
  ) {
    return null
  }
  const weekLength =
    decision.state === 'RETURN_BLOCK_28_TO_55_DAYS'
      ? 'kahden viikon'
      : decision.state === 'RETURNING_56_PLUS_DAYS'
        ? 'harjoituskertojen mukaan etenevä'
        : 'seitsemän päivän'
  const loadMessage =
    decision.state === 'BREAK_8_TO_14_DAYS'
      ? 'Sarjamäärää kevennetään ja progressio pidetään tauolla tämän jakson ajan.'
      : 'Aiemmat kuormat ovat vain historiallista tietoa. Tämän päivän kuorma kalibroidaan RIR-tavoitteen avulla.'
  return (
    <section
      className="surface-card return-to-strength-notice"
      aria-label="Tauolta paluu"
    >
      <p className="eyebrow">Tauolta paluu</p>
      <h2>Palaat harjoitteluun tauon jälkeen.</h2>
      <p>
        Vahvistettu tauko: <strong>{decision.breakDays} päivää</strong>. Käytössä on{' '}
        {weekLength} kevennetty jakso. {loadMessage}
      </p>
      {decision.reentryEndsAt && (
        <p>
          Kevennetty jakso jatkuu vähintään{' '}
          {new Date(decision.reentryEndsAt).toLocaleDateString('fi-FI')} asti.
        </p>
      )}
      {decision.state === 'RETURNING_56_PLUS_DAYS' && (
        <p>
          Hyväksyttyjä paluuharjoituksia: {decision.approvedReturnWorkoutCount}/
          {decision.requiredApprovedWorkoutCount}. Tarkka kuormaprogressio palaa vasta,
          kun paluujakso ja uudet liikekohtaiset kalibroinnit ovat valmiit.
        </p>
      )}
    </section>
  )
}

export function WorkoutPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentProfile = data.latest('profiles')
  const clock = calendarContextForProfile(currentProfile)
  const weekday = clock.weekday
  const session = planSessions(activeTrainingPlan(data)).find(
    (item) => item.day === weekday,
  )
  const todayCheckIn = data
    .list('daily_checkins')
    .find((record) => record.data.checkin_date === clock.localDate)
  const profileSettings = objectValue(currentProfile?.data.app_settings)
  const onboardingScreening = data.latest('health_screenings')
  const screeningAnswers = objectValue(onboardingScreening?.data.answers)
  const screeningReviewRequired = onboardingScreening?.data.status === 'NEEDS_REVIEW'
  const currentReadiness = storedReadiness(todayCheckIn?.data.readiness)
  const readiness = currentReadiness ?? 'GREEN'
  const safetyContext = currentWorkoutSafetyContext({
    profile: currentProfile,
    screening: onboardingScreening,
    readiness: todayCheckIn?.data.readiness,
    today: clock.localDate,
  })
  const persistedWorkout = data
    .list('workouts')
    .find(
      (record) =>
        Boolean(stringValue(record.data.scheduled_for)) &&
        localCalendarDate(
          stringValue(record.data.scheduled_for),
          clock.calendarTimeZone,
        ) === clock.localDate &&
        record.data.status === 'PLANNED',
    )
  const [activeWorkout, setActiveWorkout] = useState<LocalRecord | null>(
    persistedWorkout ?? null,
  )
  const variants = session?.variants ?? []
  const checkInAnswers = objectValue(todayCheckIn?.data.answers)
  const checkInRecommendation = objectValue(checkInAnswers.recommendation)
  const allowedSession = stringValue(
    checkInRecommendation.allowedSession,
    session?.kind ?? 'REST',
  ) as PrescribedSession['kind']
  const requestedSession = stringValue(
    checkInAnswers.plannedSession,
    session?.kind ?? 'REST',
  ) as PrescribedSession['kind']
  const effectiveSessionKind =
    allowedSession === 'REST'
      ? 'REST'
      : allowedSession === requestedSession
        ? requestedSession
        : allowedSession
  const compactMinutes = numberValue(
    checkInRecommendation.compactVariantMinutes,
    typeof checkInAnswers.availableMinutes === 'number' &&
      checkInAnswers.availableMinutes >= 10 &&
      checkInAnswers.availableMinutes < 45
      ? checkInAnswers.availableMinutes < 20
        ? 10
        : checkInAnswers.availableMinutes < 30
          ? 20
          : 30
      : 0,
  )
  const compactKind =
    compactMinutes === 10 || compactMinutes === 20 || compactMinutes === 30
      ? (`COMPACT_${compactMinutes}` as WorkoutVariant['kind'])
      : null
  const suggestedKind: WorkoutVariant['kind'] =
    searchParams.get('versio') === '10' &&
    variants.some((variant) => variant.kind === 'COMPACT_10')
      ? 'COMPACT_10'
      : compactKind && variants.some((variant) => variant.kind === compactKind)
        ? compactKind
        : readiness === 'YELLOW'
          ? 'LIGHT'
          : 'FULL'
  const [variantKind, setVariantKind] = useState<WorkoutVariant['kind']>(suggestedKind)
  const workoutLogs = data.list('workout_logs')
  const allFeedback = workoutLogs
    .map(savedFeedback)
    .filter((value): value is WorkoutFeedback => value !== null)
  const prescriptionResolution: PrescriptionResult | null = (() => {
    if (!session) return null
    if (session.unsupportedPrescription) return session.unsupportedPrescription
    if (session.prescriptionDetail && effectiveSessionKind === session.kind) {
      return {
        status: 'SUPPORTED',
        prescription: session.prescriptionDetail,
      }
    }
    const goalRecord = activeGoalRecord(data)
    const preferences = objectValue(goalRecord?.data.preferences)
    const limitationTags = confirmedLimitationTags(
      screeningAnswers.confirmed_limitation_tags,
    )
    const equipment = Array.isArray(profileSettings.equipment)
      ? profileSettings.equipment.filter(
          (item): item is string => typeof item === 'string',
        )
      : ['Kehonpaino']
    return resolvePrescription({
      sessionId: session.id,
      title:
        effectiveSessionKind === session.kind
          ? (session.title ?? sessionLabels[session.kind])
          : sessionLabels[effectiveSessionKind],
      kind: effectiveSessionKind,
      durationMinutes: session.timeBudgetMinutes ?? session.durationMinutes,
      profile: {
        goal: stringValue(
          goalRecord?.data.primary_goal,
          'GENERAL_FITNESS',
        ) as PrescribedSession['goal'],
        experience:
          profileSettings.experience === 'INTERMEDIATE' ||
          profileSettings.experience === 'ADVANCED'
            ? profileSettings.experience
            : 'BEGINNER',
        equipment,
        physicalLoad:
          profileSettings.physicalLoad === 'LOW' ||
          profileSettings.physicalLoad === 'HIGH'
            ? profileSettings.physicalLoad
            : 'MODERATE',
        minutesPerSession:
          typeof profileSettings.minutesPerSession === 'number'
            ? profileSettings.minutesPerSession
            : (session.timeBudgetMinutes ?? session.durationMinutes),
        likes: stringValue(preferences.likes),
        dislikes: stringValue(preferences.dislikes),
        limitations: [
          stringValue(screeningAnswers.current_injuries_surgeries_and_mobility_limits),
          stringValue(screeningAnswers.doctor_restrictions),
        ]
          .filter(Boolean)
          .join(' · '),
        confirmedLimitationTags: limitationTags,
        healthBlocked: safetyContext.healthBlocked,
        age: safetyContext.age,
        generatedAt: new Date().toISOString(),
        readiness: safetyContext.readiness,
        strengthHistory: strengthHistoryFromLogs(workoutLogs),
        verifiedNextLoads: verifiedNextLoadsFrom(profileSettings.verifiedNextLoads),
        strengthTrainingBackground: strengthTrainingBackgroundFrom(
          profileSettings.strengthTrainingBackground,
        ),
      },
    })
  })()
  const generatedPrescription =
    prescriptionResolution?.status === 'SUPPORTED'
      ? prescriptionResolution.prescription
      : null
  const materializedVariants = generatedPrescription
    ? variants.flatMap((variant) => {
        const adapted = adaptWorkoutPrescriptionForCurrentAthlete({
          prescription: generatedPrescription,
          variant,
          profile: currentProfile,
          screening: onboardingScreening,
          readiness: todayCheckIn?.data.readiness,
          today: clock.localDate,
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
    : variants
  const selectedVariant = materializedVariants.find(
    (variant) => variant.kind === variantKind,
  ) ?? {
    kind: 'FULL' as const,
    timeBudgetMinutes: session?.timeBudgetMinutes ?? session?.durationMinutes ?? 30,
    durationMinutes:
      generatedPrescription?.durationMinutes ?? session?.durationMinutes ?? 30,
    volumeMultiplier: 1,
  }
  const resolutionUnsupportedPrescription =
    prescriptionResolution?.status === 'UNSUPPORTED' ? prescriptionResolution : null
  const feedbackDecision = evaluateWorkoutFeedback(
    allFeedback,
    generatedPrescription?.exercises.map((exercise) => exercise.code),
  ).decision
  const previousResults = (() => {
    const codes = new Set(
      generatedPrescription?.exercises.map((exercise) => exercise.code) ?? [],
    )
    return [...allFeedback]
      .reverse()
      .find((item) =>
        item.exerciseResults?.some((result) => codes.has(result.exerciseCode)),
      )?.exerciseResults
  })()
  const previewAdaptation = (() => {
    if (!generatedPrescription) return null
    const priorResponseRequiresRecovery = feedbackDecision.action === 'RECOVERY'
    return adaptWorkoutPrescriptionForCurrentAthlete({
      prescription: generatedPrescription,
      variant: selectedVariant,
      profile: currentProfile,
      screening: onboardingScreening,
      readiness: priorResponseRequiresRecovery
        ? 'ORANGE_RECOVERY'
        : todayCheckIn?.data.readiness,
      today: clock.localDate,
    })
  })()
  const previewPrescription =
    previewAdaptation?.status === 'SUPPORTED'
      ? applyWorkoutProgression(
          refreshAdultResistanceProgression({
            prescription: previewAdaptation.prescription,
            history: strengthHistoryFromLogs(workoutLogs),
            verifiedNextLoads: verifiedNextLoadsFrom(profileSettings.verifiedNextLoads),
            generatedAt: new Date().toISOString(),
          }),
          feedbackDecision,
        )
      : null
  const storedResumedPrescription = savedPrescription(persistedWorkout ?? null)
  const resumedAuthorization = storedResumedPrescription
    ? authorizeWorkoutPrescriptionForCurrentAthlete({
        prescription: storedResumedPrescription,
        profile: currentProfile,
        screening: onboardingScreening,
        readiness: todayCheckIn?.data.readiness,
        today: clock.localDate,
      })
    : null
  const resumedPrescription =
    resumedAuthorization?.status === 'SUPPORTED' &&
    prescriptionResolution?.status === 'SUPPORTED' &&
    (storedResumedPrescription?.kind !== 'STRENGTH' ||
      prescriptionResolution.prescription.kind === 'STRENGTH')
      ? resumedAuthorization.prescription
      : null
  const resumedWorkoutLog = data
    .list('workout_logs')
    .find(
      (record) =>
        record.data.workout_id === persistedWorkout?.id &&
        record.data.completion_status === 'IN_PROGRESS',
    )
  const resumedSetLogs = data
    .list('exercise_set_logs')
    .filter((record) => record.data.workout_log_id === resumedWorkoutLog?.id)
  const [runningPrescription, setRunningPrescription] =
    useState<PrescribedSession | null>(resumedPrescription)
  const [sets, setSets] = useState<EditableSet[]>(() =>
    createSetRows(resumedPrescription, resumedSetLogs, previousResults),
  )
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)
  const resumedSessionLocked = resumedPrescription
    ? isLockedSafetyOutcome(resumedPrescription.decisionTrace.safetyOutcome)
    : false
  const [stage, setStage] = useState<'EXECUTION' | 'FEEDBACK'>(
    resumedSessionLocked ? 'FEEDBACK' : 'EXECUTION',
  )
  const [sessionLockReason, setSessionLockReason] = useState<string | null>(
    resumedSessionLocked
      ? (resumedPrescription?.decisionTrace.adaptations?.at(-1)?.reasonCodes[0] ??
          'SESSION_STOP_LOCKED')
      : null,
  )
  const [stoppedExerciseIds, setStoppedExerciseIds] = useState<string[]>([])
  const [restSeconds, setRestSeconds] = useState(0)
  const [completionStatus, setCompletionStatus] = useState<WorkoutCompletionStatus>(
    resumedSessionLocked ? 'STOPPED' : 'COMPLETED',
  )
  const [rpe, setRpe] = useState(6)
  const [difficulty, setDifficulty] = useState<WorkoutFeedback['difficulty']>('RIGHT')
  const [pain, setPain] = useState<WorkoutFeedback['pain']>('NONE')
  const [painLocation, setPainLocation] = useState('')
  const [felt, setFelt] = useState<WorkoutFeedback['felt']>('SAME')
  const [notes, setNotes] = useState('')
  const [stopReason, setStopReason] = useState<WorkoutFeedback['stopReason']>()
  const [stopPanelOpen, setStopPanelOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [nextLoadInputs, setNextLoadInputs] = useState<Record<string, string>>({})
  const [nextLoadMessages, setNextLoadMessages] = useState<
    Record<string, { kind: 'error' | 'success'; text: string }>
  >({})
  const runningAuthorization = runningPrescription
    ? authorizeWorkoutPrescriptionForCurrentAthlete({
        prescription: runningPrescription,
        profile: currentProfile,
        screening: onboardingScreening,
        readiness: todayCheckIn?.data.readiness,
        today: clock.localDate,
      })
    : null
  const unsupportedPrescription =
    resolutionUnsupportedPrescription ??
    (previewAdaptation?.status === 'UNSUPPORTED' ? previewAdaptation : null) ??
    (resumedAuthorization?.status === 'UNSUPPORTED' ? resumedAuthorization : null) ??
    (runningAuthorization?.status === 'UNSUPPORTED' ? runningAuthorization : null)

  useEffect(() => {
    if (restSeconds <= 0) return
    const timer = window.setInterval(
      () => setRestSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [restSeconds])

  if (screeningReviewRequired) {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Turvallisuus ensin</p>
            <h1>Harjoittelu odottaa oireen arviota</h1>
            <p>
              Aloituskartoituksessa ilmoitettu selvittämätön tai rasitukseen liittyvä
              varoitusoire estää harjoittelun. Sovellus ei voi kuitata oiretta
              arvioiduksi.
            </p>
          </div>
        </header>
        <Link className="button button-secondary" to="/tiedot">
          Hallitse terveystietoja
        </Link>
      </div>
    )
  }

  if (!todayCheckIn) {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Ennen harjoitusta</p>
            <h1>Tarkista päivän vointi</h1>
            <p>Kuntotarkistus valitsee suunnitelmasta turvallisen version.</p>
          </div>
        </header>
        <Link className="button button-primary" to="/kuntotarkistus">
          Tee kuntotarkistus
        </Link>
      </div>
    )
  }

  if (readiness === 'RED_STOP') {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Turvallisuus ensin</p>
            <h1>Harjoitus on pysäytetty</h1>
            <p>
              {stringValue(
                checkInRecommendation.action,
                `${readinessLabels.RED_STOP}. Noudata kuntotarkistuksen toimintaohjetta.`,
              )}
            </p>
          </div>
        </header>
        <Link className="button button-secondary" to="/">
          Takaisin Tänään-näkymään
        </Link>
      </div>
    )
  }

  if (allowedSession === 'REST') {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Tämän päivän aika</p>
            <h1>Harjoitus jää tänään väliin</h1>
            <p>
              Ilmoitit käytettävissä olevaksi ajaksi 0 minuuttia. Harjoitusta ei avata
              eikä väliin jäänyttä kuormaa siirretä automaattisesti.
            </p>
          </div>
        </header>
        <Link className="button button-secondary" to="/">
          Takaisin Tänään-näkymään
        </Link>
      </div>
    )
  }

  if (feedbackDecision.action === 'REFER') {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Turvallisuus ensin</p>
            <h1>Harjoittelua ei jatketa vielä</h1>
            <p>{feedbackDecision.message}</p>
          </div>
        </header>
        <div className="status-banner danger" role="alert">
          Älä käytä sovellusta vamman diagnoosiin tai hoidon korvaamiseen.
        </div>
        <Link className="button button-secondary" to="/">
          Takaisin Tänään-näkymään
        </Link>
      </div>
    )
  }

  if (unsupportedPrescription) {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Harjoitustyyppi ei ole vielä tuettu</p>
            <h1>Harjoitusta ei muodosteta väärillä säännöillä</h1>
            <p>{unsupportedPrescription.userMessage}</p>
          </div>
        </header>
        <div className="status-banner" role="status">
          Tämä rajoitus estää vääränlaisen harjoituksen näyttämisen turvallisuussyistä.
        </div>
        <Link className="button button-secondary" to="/viikko">
          Katso viikkosuunnitelma
        </Link>
      </div>
    )
  }

  if (!session || !previewPrescription) {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Palautumispäivä</p>
            <h1>Ohjelmassa ei ole harjoitusta tänään</h1>
            <p>
              Voit tehdä kevyen kävelyn tai vapaan liikkuvuushetken voinnin salliessa.
            </p>
          </div>
        </header>
        <Link className="button button-secondary" to="/viikko">
          Katso viikkosuunnitelma
        </Link>
      </div>
    )
  }

  const saveNextLoadConfirmation = async (exercise: ExercisePrescription) => {
    const currentLoadKg = exercise.progressionDecision?.currentLoadKg
    if (
      currentLoadKg === undefined ||
      !exercise.contentVersion ||
      !exercise.loadContextId
    ) {
      setNextLoadMessages((current) => ({
        ...current,
        [exercise.id]: {
          kind: 'error',
          text: 'Liikeversio tai kuormakonteksti puuttuu, joten kuormaa ei tallennettu.',
        },
      }))
      return
    }
    const nextAvailableLoadKg = parseOptionalNumber(nextLoadInputs[exercise.id] ?? '')
    if (nextAvailableLoadKg === null) {
      setNextLoadMessages((current) => ({
        ...current,
        [exercise.id]: {
          kind: 'error',
          text: 'Anna seuraava kuorma numeroina kilogrammoina.',
        },
      }))
      return
    }
    setPending(true)
    try {
      const result = await confirmNextAvailableLoad(data, {
        exerciseCode: exercise.code,
        exerciseVersion: exercise.contentVersion,
        loadType: exercise.loadType,
        loadContextId: exercise.loadContextId,
        currentLoadKg,
        nextAvailableLoadKg,
      })
      setNextLoadMessages((current) => ({
        ...current,
        [exercise.id]: result.ok
          ? {
              kind: 'success',
              text: `Seuraava käytettävissä oleva kuorma ${nextAvailableLoadKg} kg vahvistettiin.`,
            }
          : { kind: 'error', text: result.messageFi },
      }))
    } catch (reason) {
      setNextLoadMessages((current) => ({
        ...current,
        [exercise.id]: {
          kind: 'error',
          text:
            reason instanceof Error
              ? reason.message
              : 'Seuraavaa kuormaa ei voitu tallentaa.',
        },
      }))
    } finally {
      setPending(false)
    }
  }

  const begin = async () => {
    setPending(true)
    setError('')
    try {
      const workout = await startWorkout(data, {
        title: previewPrescription.title,
        durationMinutes: previewPrescription.durationMinutes,
        intensity: readiness === 'ORANGE_RECOVERY' ? 'RECOVERY' : session.intensity,
        variants: materializedVariants,
        prescription: previewPrescription,
      })
      setActiveWorkout(workout)
      setRunningPrescription(previewPrescription)
      setSets(createSetRows(previewPrescription, [], previousResults))
      setActiveExerciseIndex(0)
      setStage('EXECUTION')
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Harjoitusta ei voitu aloittaa.',
      )
    } finally {
      setPending(false)
    }
  }

  const updateSet = (
    exerciseId: string,
    setNumber: number,
    patch: Partial<EditableSet>,
  ) => {
    setSets((current) =>
      current.map((item) =>
        item.exerciseId === exerciseId && item.setNumber === setNumber
          ? { ...item, ...patch }
          : item,
      ),
    )
  }

  const showStage = (nextStage: 'EXECUTION' | 'FEEDBACK') => {
    setStage(nextStage)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }))
  }

  const recordAdaptation = (
    original: Record<string, string | number | boolean | null>,
    adjusted: Record<string, string | number | boolean | null>,
    reasonCodes: string[],
    safetyOutcome?: 'MODIFY' | 'STOP',
    persistImmediately = false,
  ) => {
    if (!runningPrescription) return
    const nextPrescription: PrescribedSession = {
      ...runningPrescription,
      decisionTrace: {
        ...runningPrescription.decisionTrace,
        safetyOutcome:
          safetyOutcome === 'STOP'
            ? 'STOP'
            : safetyOutcome === 'MODIFY' &&
                runningPrescription.decisionTrace.safetyOutcome === 'PROCEED'
              ? 'MODIFY'
              : runningPrescription.decisionTrace.safetyOutcome,
        adaptations: [
          ...(runningPrescription.decisionTrace.adaptations ?? []),
          { original, adjusted, reasonCodes },
        ],
      },
    }
    setRunningPrescription(nextPrescription)
    if (!activeWorkout || !persistImmediately) return
    void saveWorkoutAdaptation(data, activeWorkout, nextPrescription).catch(
      (reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Harjoituksen muutosta ei voitu tallentaa.',
        )
      },
    )
  }

  const lockSession = (
    reasonCode: string,
    original: Record<string, string | number | boolean | null> = {
      sessionStatus: 'IN_PROGRESS',
    },
    action = 'LOCK_SESSION_STOP',
  ) => {
    recordAdaptation(
      original,
      { action, sessionStatus: 'STOPPED' },
      [reasonCode],
      'STOP',
      true,
    )
    setSessionLockReason(reasonCode)
    setCompletionStatus('STOPPED')
    setRestSeconds(0)
    showStage('FEEDBACK')
  }

  const stopForSymptoms = (reason: NonNullable<WorkoutFeedback['stopReason']>) => {
    setStopReason(reason)
    setCompletionStatus('STOPPED')
    if (reason === 'PAIN') setPain('SEVERE')
    if (
      reason === 'DIZZINESS' ||
      reason === 'BREATHING' ||
      reason === 'NEUROLOGICAL' ||
      reason === 'PAIN'
    ) {
      setFelt('WORSE')
    }
    setStopPanelOpen(false)
    const reasonCode =
      reason === 'PAIN'
        ? 'SEVERE_PAIN_REPORTED'
        : reason === 'DIZZINESS'
          ? 'DIZZINESS_SESSION_STOP'
          : reason === 'BREATHING'
            ? 'CARDIORESPIRATORY_SESSION_STOP'
            : reason === 'NEUROLOGICAL'
              ? 'NEUROLOGICAL_SESSION_STOP'
              : null
    if (reasonCode) {
      lockSession(reasonCode)
    } else {
      showStage('FEEDBACK')
    }
  }

  const goToFeedback = () => {
    setCompletionStatus(completedSets === sets.length ? 'COMPLETED' : 'PARTIAL')
    showStage('FEEDBACK')
  }

  const persistSet = (set: EditableSet) => {
    if (!activeWorkout || !runningPrescription) return
    const exercise = runningPrescription.exercises.find(
      (item) => item.id === set.exerciseId,
    )
    if (!exercise) return
    void saveWorkoutSet(data, activeWorkout, runningPrescription, {
      exerciseId: set.exerciseId,
      setNumber: set.setNumber,
      repetitions: parseOptionalNumber(set.repetitionsInput),
      loadKg: numericLoad(exercise, set.loadInput),
      loadText: set.loadInput.trim() || null,
      rir: parseOptionalNumber(set.rirInput),
      completed: set.completed,
      painResponse: set.painInput || undefined,
      techniqueOk: set.techniqueInput === '' ? undefined : set.techniqueInput === 'OK',
      adaptationReasonCodes: set.adaptationReasonCodes,
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Sarjaa ei voitu tallentaa.')
    })
  }

  const finish = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeWorkout || !runningPrescription) return
    if (difficulty === 'RIGHT' && rpe >= 9) {
      const accepted = confirm(
        'Valitsit harjoituksen sopivaksi mutta erittäin raskaaksi (RPE 9–10). Säilytetäänkö molemmat vastaukset?',
      )
      if (!accepted) return
    }
    if (pain === 'NONE' && painLocation.trim()) {
      setError('Valitsit ”Ei kipua”, mutta täytit kivun sijainnin. Korjaa toinen tieto.')
      return
    }
    setPending(true)
    setError('')
    const feedback: WorkoutFeedback = {
      completionStatus,
      sessionRpe: rpe,
      difficulty,
      pain,
      painLocation,
      felt,
      notes,
      stopReason,
      exerciseResults: runningPrescription.exercises.map((exercise) => {
        const exerciseSets = sets.filter((item) => item.exerciseId === exercise.id)
        return {
          exerciseCode: exercise.code,
          exerciseVersion: exercise.contentVersion,
          exerciseName: exercise.nameFi,
          loadType: exercise.loadType,
          loadContextId: exercise.loadContextId,
          completedSets: exerciseSets.filter((item) => item.completed).length,
          plannedSets: doseUnitCount(exercise),
          completed: exerciseSets.map((item) => item.completed),
          repetitions: exerciseSets.map((item) =>
            parseOptionalNumber(item.repetitionsInput),
          ),
          loads: exerciseSets.map((item) => item.loadInput.trim() || null),
          rirs: exerciseSets.map((item) => parseOptionalNumber(item.rirInput)),
          painResponses: exerciseSets.map((item) => item.painInput || null),
          techniqueOk: exerciseSets.map((item) =>
            item.techniqueInput === '' ? null : item.techniqueInput === 'OK',
          ),
          targetRepetitions: exercise.repetitions,
          targetRpe: exercise.targetRpe,
          targetRirRange:
            exercise.targetRirRange ??
            (exercise.targetRir === undefined
              ? undefined
              : [exercise.targetRir, Math.min(5, exercise.targetRir + 1)]),
          primaryMuscles: exercise.primaryMuscles,
          secondaryMuscles: exercise.secondaryMuscles,
        }
      }),
    }
    try {
      const log = await completeWorkout(data, activeWorkout, {
        durationMinutes: runningPrescription.durationMinutes,
        feedback,
        prescription: runningPrescription,
        sets: sets.map((item) => {
          const exercise = runningPrescription.exercises.find(
            (candidate) => candidate.id === item.exerciseId,
          )!
          return {
            exerciseId: item.exerciseId,
            setNumber: item.setNumber,
            repetitions: parseOptionalNumber(item.repetitionsInput),
            loadKg: numericLoad(exercise, item.loadInput),
            loadText: item.loadInput.trim() || null,
            rir: parseOptionalNumber(item.rirInput),
            completed: item.completed,
            painResponse: item.painInput || undefined,
            techniqueOk:
              item.techniqueInput === '' ? undefined : item.techniqueInput === 'OK',
            adaptationReasonCodes: item.adaptationReasonCodes,
          }
        }),
      })
      navigate(`/historia/${log.id}`, { replace: true })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Harjoitusta ei voitu tallentaa.',
      )
    } finally {
      setPending(false)
    }
  }

  const prescription = runningPrescription ?? previewPrescription
  const activeExercise = prescription.exercises[activeExerciseIndex]
  const completedSets = sets.filter((item) => item.completed).length
  const availableEquipment = Array.isArray(profileSettings.equipment)
    ? profileSettings.equipment.filter((item): item is string => typeof item === 'string')
    : ['Kehonpaino']
  const alternatives = activeExercise
    ? exerciseSubstitutions(activeExercise, availableEquipment, {
        confirmedLimitationTags: confirmedLimitationTags(
          objectValue(onboardingScreening?.data.answers).confirmed_limitation_tags,
        ),
        history: strengthHistoryFromLogs(workoutLogs),
        generatedAt: new Date().toISOString(),
        plannedExercises: prescription.exercises,
      })
    : []
  const capability = activeExercise
    ? estimateExerciseCapability(
        allFeedback.flatMap((item) => item.exerciseResults ?? []),
        activeExercise.code,
      )
    : null
  const currentExperience =
    profileSettings.experience === 'INTERMEDIATE' ||
    profileSettings.experience === 'ADVANCED'
      ? profileSettings.experience
      : 'BEGINNER'

  const applySetAdaptation = (exercise: ExercisePrescription, completed: EditableSet) => {
    if (!usesStrengthLog(exercise) || exercise.targetRir === undefined) {
      persistSet(completed)
      return
    }
    const repetitions = parseOptionalNumber(completed.repetitionsInput)
    const completedRir = parseOptionalNumber(completed.rirInput)
    const completedLoadKg = numericLoad(exercise, completed.loadInput)
    if (
      repetitions === null ||
      completed.painInput === '' ||
      completed.techniqueInput === ''
    ) {
      setError('Kirjaa sarjan toistot, RIR, kipu ja tekniikan onnistuminen.')
      persistSet(completed)
      return
    }
    const targetRepetitions = Number(
      exercise.repetitions?.match(/\d+/u)?.[0] ?? repetitions,
    )
    const adaptation = adaptNextSet({
      prescribedLoadKg: completedLoadKg ?? undefined,
      prescribedRepetitions: targetRepetitions,
      targetRir: exercise.targetRirRange ?? [
        exercise.targetRir,
        Math.min(5, exercise.targetRir + 1),
      ],
      completedLoadKg: completedLoadKg ?? undefined,
      completedRepetitions: repetitions,
      completedRir: completedRir ?? undefined,
      pain: completed.painInput,
      techniqueOk: completed.techniqueInput === 'OK',
      experience: currentExperience,
    })
    const original = {
      exerciseCode: exercise.code,
      exerciseVersion: exercise.contentVersion ?? 'legacy',
      setNumber: completed.setNumber,
      loadKg: completedLoadKg,
      repetitions,
      rir: completedRir,
      pain: completed.painInput,
      techniqueOk: completed.techniqueInput === 'OK',
    }
    if (adaptation.action === 'REFER_SAFETY') {
      setPain('SEVERE')
      setStopReason('PAIN')
      persistSet({ ...completed, adaptationReasonCodes: adaptation.reasonCodes })
      lockSession(
        adaptation.reasonCodes[0] ?? 'SEVERE_PAIN_REPORTED',
        original,
        adaptation.action,
      )
      return
    }
    recordAdaptation(
      original,
      {
        action: adaptation.action,
        nextLoadKg: adaptation.adjustedLoadKg ?? null,
        nextRepetitions: adaptation.adjustedRepetitions ?? null,
      },
      adaptation.reasonCodes,
      adaptation.action === 'STOP_EXERCISE' ? 'MODIFY' : undefined,
    )
    persistSet({ ...completed, adaptationReasonCodes: adaptation.reasonCodes })
    if (adaptation.action === 'STOP_EXERCISE') {
      setStoppedExerciseIds((current) =>
        current.includes(exercise.id) ? current : [...current, exercise.id],
      )
      setRestSeconds(0)
      setError(
        'Liike pysäytettiin ilmoitetun kivun tai tekniikan heikkenemisen vuoksi. Älä tee liikkeen jäljellä olevia sarjoja.',
      )
      return
    }
    const nextSetNumber = completed.setNumber + 1
    setSets((current) =>
      current.map((candidate) => {
        if (
          candidate.exerciseId !== completed.exerciseId ||
          candidate.setNumber !== nextSetNumber ||
          candidate.completed
        ) {
          return candidate
        }
        if (adaptation.adjustedLoadKg !== undefined) {
          return {
            ...candidate,
            loadInput: String(adaptation.adjustedLoadKg).replace('.', ','),
          }
        }
        if (adaptation.adjustedRepetitions !== undefined) {
          return {
            ...candidate,
            repetitionsInput: String(adaptation.adjustedRepetitions),
          }
        }
        return candidate
      }),
    )
  }

  const switchExercise = (replacement: ExercisePrescription) => {
    if (!runningPrescription || !activeExercise) return
    const completedForExercise = sets.filter(
      (item) => item.exerciseId === activeExercise.id && item.completed,
    )
    const remainingUnits = doseUnitCount(activeExercise) - completedForExercise.length
    if (remainingUnits <= 0) {
      setError(
        'Liikkeen kaikki osuudet on jo kirjattu, joten korvaavaa liikettä ei tarvita.',
      )
      return
    }
    const resizeStrengthExercise = (
      exercise: ExercisePrescription,
      units: number,
    ): ExercisePrescription => {
      const dose = legacyDose(exercise)
      if (dose.kind !== 'STRENGTH_SETS') return { ...exercise, sets: units }
      return {
        ...exercise,
        sets: units,
        dose: { ...dose, sets: units },
      }
    }
    const completedPart = resizeStrengthExercise(
      activeExercise,
      completedForExercise.length,
    )
    const replacementPart = resizeStrengthExercise(replacement, remainingUnits)
    const replaceInList = (exercise: ExercisePrescription) =>
      exercise.id !== activeExercise.id
        ? [exercise]
        : completedForExercise.length > 0
          ? [completedPart, replacementPart]
          : [replacementPart]
    const replacementCandidate: PrescribedSession = {
      ...runningPrescription,
      exercises: runningPrescription.exercises.flatMap(replaceInList),
      blocks: runningPrescription.blocks?.flatMap(replaceInList),
      decisionTrace: {
        ...runningPrescription.decisionTrace,
        safetyOutcome:
          runningPrescription.decisionTrace.safetyOutcome === 'PROCEED'
            ? 'MODIFY'
            : runningPrescription.decisionTrace.safetyOutcome,
        adaptations: [
          ...(runningPrescription.decisionTrace.adaptations ?? []),
          {
            original: {
              exerciseCode: activeExercise.code,
              completedUnits: completedForExercise.length,
              remainingUnits,
            },
            adjusted: {
              action: 'SUBSTITUTE_REMAINING_UNITS',
              replacementCode: replacement.code,
              replacementUnits: remainingUnits,
            },
            reasonCodes: ['USER_SELECTED_SAFE_SUBSTITUTION'],
          },
        ],
      },
    }
    const nextPrescription =
      replacementCandidate.kind === 'STRENGTH'
        ? refreshStrengthPrescriptionTimeEstimate(replacementCandidate)
        : replacementCandidate
    if (
      nextPrescription.kind === 'STRENGTH' &&
      nextPrescription.calculatedTotalSeconds! >
        (nextPrescription.timeBudgetMinutes ?? nextPrescription.durationMinutes) * 60
    ) {
      setError(
        'Korvaava liike ei mahdu jäljellä olevaan aikabudjettiin turvallisia palautuksia lyhentämättä.',
      )
      return
    }
    const replacementRows = createSetRows(
      { ...nextPrescription, exercises: [replacementPart] },
      [],
      previousResults,
    )
    setSets((current) => [
      ...current.filter(
        (item) => item.exerciseId !== activeExercise.id || item.completed,
      ),
      ...replacementRows,
    ])
    setRunningPrescription(nextPrescription)
    if (completedForExercise.length > 0) {
      setActiveExerciseIndex((index) => index + 1)
    }
    setStoppedExerciseIds((current) => current.filter((id) => id !== activeExercise.id))
    setError('')
    if (activeWorkout) {
      void saveWorkoutAdaptation(data, activeWorkout, nextPrescription).catch(
        (reason: unknown) => {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Liikkeen vaihtoa ei voitu tallentaa.',
          )
        },
      )
    }
  }

  return (
    <div className="page-stack workout-page">
      <header className="section-heading workout-heading">
        <div>
          <p className="eyebrow">Päivän harjoitus</p>
          <h1>{prescription.title}</h1>
          <p>
            {readinessLabels[readiness]} · {prescription.durationMinutes} min ·{' '}
            {prescription.exercises.length} liikettä
          </p>
        </div>
        {activeWorkout && <span className="state-pill">Harjoitus käynnissä</span>}
      </header>

      <StrengthReturnNotice prescription={prescription} />

      {!activeWorkout &&
        session?.strengthWeekContext &&
        (variantKind !== 'FULL' ||
          readiness !== 'GREEN' ||
          effectiveSessionKind !== session.kind) && (
          <div className="status-banner" role="status">
            <strong>Päivän ohjelmaa sovitettiin ennakkonäkymästä.</strong>{' '}
            {effectiveSessionKind !== session.kind
              ? 'Kuntotarkistus vaihtoi harjoitustyypin tämän päivän turvallisen päätöksen perusteella.'
              : variantKind !== 'FULL'
                ? 'Käytössä oleva aika tai päivän valmius valitsi lyhyemmän tai kevennetyn version samasta viikkorungosta.'
                : 'Päivän valmius kevensi samaa viikkorunkoa.'}
          </div>
        )}

      {!activeWorkout && (
        <>
          {feedbackDecision.action !== 'MAINTAIN' && (
            <ProgressionNotice decision={feedbackDecision} />
          )}
          <section className="surface-card">
            <fieldset className="form">
              <legend>Harjoituksen versio</legend>
              <div className="variant-selector">
                {materializedVariants.map((variant) => (
                  <label className="choice-card" key={variant.kind}>
                    <input
                      type="radio"
                      name="variant"
                      checked={variantKind === variant.kind}
                      onChange={() => setVariantKind(variant.kind)}
                    />
                    <span>
                      {variantLabels[variant.kind]}
                      <small>{variant.durationMinutes} min</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="surface-card workout-plan-card">
            <div className="workout-plan-intro">
              <div>
                <p className="eyebrow">Suoritettava ohjelma</p>
                <h2>Liikkeet, sarjat ja kuormitus</h2>
              </div>
            </div>
            <div className="warmup-strip">
              <strong>Lämmittely</strong>
              <span>{prescription.warmup.join(' · ')}</span>
            </div>
            <ol className="exercise-plan-list">
              {prescription.exercises.map((exercise, index) => (
                <li key={exercise.id}>
                  <div className="exercise-order" aria-hidden="true">
                    {index + 1}
                  </div>
                  <div>
                    <h3>{exercise.nameFi}</h3>
                    <p>{exercise.instructionsFi}</p>
                    <div className="exercise-dose">
                      <strong>{doseLabelFi(exercise)}</strong>
                      {exercise.restSeconds > 0 && (
                        <span>{exercise.restSeconds} s palautus</span>
                      )}
                      <span>RPE {exercise.targetRpe}/10</span>
                    </div>
                    <p className="progression-action">{exercise.loadGuidance}</p>
                    {requestsNextLoadConfirmation(exercise) && (
                      <div className="next-load-confirmation">
                        <strong>Vahvista seuraava käytettävissä oleva kuorma</strong>
                        <p>
                          Nykyinen kuorma:{' '}
                          <strong>
                            {exercise.progressionDecision?.currentLoadKg} kg
                          </strong>
                        </p>
                        <label className="field">
                          <span>Mikä on pienin seuraava käytettävissä oleva kuorma?</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Seuraava kuorma liikkeelle ${exercise.nameFi}`}
                            value={nextLoadInputs[exercise.id] ?? ''}
                            onChange={(event) =>
                              setNextLoadInputs((current) => ({
                                ...current,
                                [exercise.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={pending}
                          onClick={() => void saveNextLoadConfirmation(exercise)}
                        >
                          Vahvista kuorma
                        </button>
                        {nextLoadMessages[exercise.id] && (
                          <p
                            className={
                              nextLoadMessages[exercise.id]?.kind === 'error'
                                ? 'form-error'
                                : 'form-note'
                            }
                            role={
                              nextLoadMessages[exercise.id]?.kind === 'error'
                                ? 'alert'
                                : 'status'
                            }
                          >
                            {nextLoadMessages[exercise.id]?.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="warmup-strip">
              <strong>Loppuverryttely</strong>
              <span>{prescription.cooldown.join(' · ')}</span>
            </div>
            <details className="decision-details">
              <summary>Miksi juuri tämä harjoitus?</summary>
              <ul>
                {prescription.decisionTrace.rules.map((rule) => (
                  <li key={rule.ruleId}>{rule.message}</li>
                ))}
              </ul>
              <p>{prescription.progression}</p>
            </details>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void begin()}
              disabled={pending}
            >
              {pending ? 'Aloitetaan…' : 'Aloita harjoitus'}
            </button>
          </section>
        </>
      )}

      {activeWorkout && stage === 'EXECUTION' && activeExercise && (
        <section className="surface-card active-exercise-card">
          <div className="active-exercise-progress">
            <span>
              Liike {activeExerciseIndex + 1}/{prescription.exercises.length}
            </span>
            <span>
              {completedSets}/{sets.length} sarjaa/osiota kirjattu
            </span>
          </div>
          <progress
            max={prescription.exercises.length}
            value={activeExerciseIndex + 1}
            aria-label="Harjoituksen eteneminen"
          />
          <p className="eyebrow">{activeExercise.category}</p>
          <h2>{activeExercise.nameFi}</h2>
          <p className="exercise-instruction">{activeExercise.instructionsFi}</p>
          {activeExercise.techniqueVideoUrl && (
            <a
              className="button button-secondary technique-link"
              href={activeExercise.techniqueVideoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Katso tekniikka YouTubessa
            </a>
          )}
          <div className="exercise-target-grid">
            <div>
              <span>Sarjat, vedot tai osuudet</span>
              <strong>{doseUnitCount(activeExercise)}</strong>
            </div>
            <div>
              <span>Annos</span>
              <strong>{doseLabelFi(activeExercise)}</strong>
            </div>
            <details className="target-help">
              <summary>
                <span>Tavoite</span>
                <strong>RPE {activeExercise.targetRpe}</strong>
              </summary>
              <p>
                Sarjan RPE {activeExercise.targetRpe} tarkoittaa noin{' '}
                {Math.max(0, 10 - activeExercise.targetRpe)} hyvää toistoa varastossa.
                Arvioi sarjaa, ei koko harjoitusta.
              </p>
            </details>
            <div>
              <span>Palautus sarjojen välissä</span>
              <strong>{activeExercise.restSeconds} s</strong>
            </div>
          </div>
          <p className="load-guidance">{activeExercise.loadGuidance}</p>
          {usesStrengthLog(activeExercise) && capability && (
            <p className="form-note">
              {capability.calibrationRequired
                ? 'Kuormahistoriaa on vielä vähän. Aloita kalibroivalla kuormalla, jolla tavoitetoistot jäävät hallitusti tavoite-RIR:n päähän uupumuksesta.'
                : `Kuorma-arvion luottamus: ${capability.confidence === 'HIGH' ? 'hyvä' : 'kohtalainen'}. Edellinen vertailukelpoinen kuorma esitäytetään sarjoihin.`}
            </p>
          )}
          <div className="set-log-grid">
            {sets
              .filter((item) => item.exerciseId === activeExercise.id)
              .map((item) => (
                <div
                  className={`set-row${item.completed ? ' completed' : ''}${
                    usesStrengthLog(activeExercise) ? '' : ' duration'
                  }`}
                  key={item.setNumber}
                >
                  <strong>{doseUnitLabel(activeExercise, item.setNumber)}</strong>
                  {usesStrengthLog(activeExercise) && (
                    <label className="compact-field">
                      <span>Toistot</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={item.repetitionsInput}
                        onChange={(event) =>
                          updateSet(activeExercise.id, item.setNumber, {
                            repetitionsInput: event.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                  {usesStrengthLog(activeExercise) &&
                    activeExercise.loadType !== 'NONE' && (
                      <label className="compact-field">
                        <span>{activeExercise.loadLabelFi}</span>
                        {activeExercise.loadType === 'BAND' ? (
                          <select
                            value={item.loadInput}
                            onChange={(event) => {
                              updateSet(activeExercise.id, item.setNumber, {
                                loadInput: event.target.value,
                              })
                            }}
                          >
                            <option value="">Valitse vastus</option>
                            {activeExercise.loadOptions?.map((option) => (
                              <option value={option} key={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            inputMode={
                              activeExercise.loadType === 'BODYWEIGHT'
                                ? 'text'
                                : 'decimal'
                            }
                            placeholder={
                              activeExercise.loadType === 'BODYWEIGHT'
                                ? 'Esim. oma paino tai +5 kg'
                                : undefined
                            }
                            value={item.loadInput}
                            onChange={(event) =>
                              updateSet(activeExercise.id, item.setNumber, {
                                loadInput: event.target.value,
                              })
                            }
                          />
                        )}
                      </label>
                    )}
                  {usesStrengthLog(activeExercise) && activeExercise.keyExercise && (
                    <label className="compact-field">
                      <span>RIR (toistoa varastossa)</span>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        inputMode="numeric"
                        value={item.rirInput}
                        onChange={(event) =>
                          updateSet(activeExercise.id, item.setNumber, {
                            rirInput: event.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                  {usesStrengthLog(activeExercise) && (
                    <label className="compact-field">
                      <span>Kipu sarjan aikana</span>
                      <select
                        value={item.painInput}
                        disabled={
                          sessionLockReason !== null ||
                          stoppedExerciseIds.includes(activeExercise.id)
                        }
                        onChange={(event) =>
                          updateSet(activeExercise.id, item.setNumber, {
                            painInput: event.target.value as EditableSet['painInput'],
                          })
                        }
                      >
                        <option value="">Valitse</option>
                        <option value="NONE">Ei kipua</option>
                        <option value="MILD">Lievä, ei pahene</option>
                        <option value="WORSENING">Paheneva kipu</option>
                        <option value="SHARP">Terävä tai repivä kipu</option>
                        <option value="FUNCTION_ALTERING">Muuttaa liikettä</option>
                        <option value="SEVERE">Voimakas kipu</option>
                      </select>
                    </label>
                  )}
                  {usesStrengthLog(activeExercise) && (
                    <label className="compact-field">
                      <span>Tekniikka</span>
                      <select
                        value={item.techniqueInput}
                        disabled={
                          sessionLockReason !== null ||
                          stoppedExerciseIds.includes(activeExercise.id)
                        }
                        onChange={(event) =>
                          updateSet(activeExercise.id, item.setNumber, {
                            techniqueInput: event.target
                              .value as EditableSet['techniqueInput'],
                          })
                        }
                      >
                        <option value="">Valitse</option>
                        <option value="OK">Pysyi hallittuna</option>
                        <option value="DEGRADED">Heikkeni</option>
                      </select>
                    </label>
                  )}
                  <label className="set-complete">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={
                        sessionLockReason !== null ||
                        stoppedExerciseIds.includes(activeExercise.id)
                      }
                      onChange={(event) => {
                        if (
                          event.target.checked &&
                          usesStrengthLog(activeExercise) &&
                          (item.painInput === '' || item.techniqueInput === '')
                        ) {
                          setError(
                            'Valitse sarjan kiputieto ja tekniikan onnistuminen ennen valmiiksi merkitsemistä.',
                          )
                          return
                        }
                        const nextSet = { ...item, completed: event.target.checked }
                        setError('')
                        updateSet(activeExercise.id, item.setNumber, nextSet)
                        if (nextSet.completed && activeExercise.restSeconds > 0) {
                          setRestSeconds(activeExercise.restSeconds)
                        }
                        if (nextSet.completed) {
                          applySetAdaptation(activeExercise, nextSet)
                        } else {
                          persistSet(nextSet)
                        }
                      }}
                    />
                    <span>Valmis</span>
                  </label>
                </div>
              ))}
          </div>
          {restSeconds > 0 && (
            <div className="rest-timer" role="timer" aria-live="polite">
              <div>
                <span>Palautus sarjojen välissä</span>
                <strong>
                  {Math.floor(restSeconds / 60)}:
                  {String(restSeconds % 60).padStart(2, '0')}
                </strong>
              </div>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setRestSeconds((seconds) => seconds + 30)}
              >
                +30 s
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setRestSeconds(0)}
              >
                Ohita
              </button>
            </div>
          )}
          <div className="safety-note">
            <strong>Keskeytä tarvittaessa.</strong> {activeExercise.stopCondition}
          </div>
          <button
            className="button button-danger"
            type="button"
            onClick={() => setStopPanelOpen((open) => !open)}
          >
            Keskeytä harjoitus
          </button>
          {stopPanelOpen && (
            <div className="stop-reason-panel" role="group" aria-label="Keskeytyksen syy">
              <strong>Miksi keskeytät?</strong>
              <div className="button-row">
                <button type="button" onClick={() => stopForSymptoms('PAIN')}>
                  Voimakas tai terävä kipu
                </button>
                <button type="button" onClick={() => stopForSymptoms('DIZZINESS')}>
                  Huimaus tai pyörtymisen tunne
                </button>
                <button type="button" onClick={() => stopForSymptoms('BREATHING')}>
                  Hengitysvaikeus tai rintaoire
                </button>
                <button type="button" onClick={() => stopForSymptoms('NEUROLOGICAL')}>
                  Uusi neurologinen oire
                </button>
                <button type="button" onClick={() => stopForSymptoms('TECHNIQUE')}>
                  Tekniikka ei pysy
                </button>
                <button type="button" onClick={() => stopForSymptoms('EQUIPMENT')}>
                  Välineongelma
                </button>
                <button type="button" onClick={() => stopForSymptoms('OTHER')}>
                  Muu syy
                </button>
              </div>
            </div>
          )}
          <details className="decision-details">
            <summary>Tarvitsen vaihtoehdon</summary>
            {alternatives.length ? (
              <div className="substitution-actions">
                {alternatives.map((alternative) => (
                  <button
                    className="button button-secondary"
                    type="button"
                    key={alternative.code}
                    onClick={() => switchExercise(alternative)}
                  >
                    Vaihda: {alternative.nameFi}
                  </button>
                ))}
              </div>
            ) : (
              <p>Nykyisillä välineillä ei löytynyt turvallista korvaavaa liikettä.</p>
            )}
          </details>
          <div className="button-row workout-navigation">
            <button
              className="button button-secondary"
              type="button"
              disabled={activeExerciseIndex === 0}
              onClick={() => setActiveExerciseIndex((index) => Math.max(0, index - 1))}
            >
              Edellinen
            </button>
            {activeExerciseIndex < prescription.exercises.length - 1 ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() => setActiveExerciseIndex((index) => index + 1)}
              >
                Seuraava liike
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                onClick={goToFeedback}
              >
                Siirry palautteeseen
              </button>
            )}
          </div>
        </section>
      )}

      {activeWorkout && stage === 'FEEDBACK' && (
        <form className="surface-card form feedback-form" onSubmit={finish}>
          <div>
            <p className="eyebrow">Harjoituksen jälkeen</p>
            <h2>Miten harjoitus toteutui?</h2>
            <p>
              Kirjasit {completedSets}/{sets.length} sarjaa. Palaute vaikuttaa seuraavaan
              etenemispäätökseen, mutta ei muuta tavoitettasi automaattisesti.
            </p>
          </div>
          {sessionLockReason && (
            <div className="status-banner danger" role="alert">
              <strong>Harjoitus on lukittu STOP-tilaan.</strong> Harjoitteluun ei voi
              palata tästä näkymästä. Päätöstunnus: {sessionLockReason}.
            </div>
          )}
          <label className="field">
            <span>Toteuma</span>
            <select
              value={completionStatus}
              disabled={sessionLockReason !== null}
              onChange={(event) =>
                setCompletionStatus(event.target.value as WorkoutCompletionStatus)
              }
            >
              <option value="COMPLETED">Tein suunnitelman mukaan</option>
              <option value="PARTIAL">Tein osan harjoituksesta</option>
              <option value="STOPPED">Keskeytin harjoituksen</option>
            </select>
          </label>
          <label className="field">
            <span>Kuinka kuormittavalta koko harjoitus tuntui? RPE {rpe}/10</span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={rpe}
              onChange={(event) => setRpe(Number(event.target.value))}
            />
            <small>
              Arvioi koko harjoitusta lämmittelyineen ja palautuksineen: 0 = lepo, 3 =
              kevyt, 5 = kohtalainen, 7 = raskas, 9 = erittäin raskas ja 10 =
              maksimaalinen.
            </small>
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Vaikeustaso</span>
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(event.target.value as WorkoutFeedback['difficulty'])
                }
              >
                <option value="TOO_EASY">Liian helppo</option>
                <option value="RIGHT">Sopiva</option>
                <option value="TOO_HARD">Liian raskas</option>
              </select>
            </label>
            <label className="field">
              <span>Olo harjoituksen jälkeen</span>
              <select
                value={felt}
                onChange={(event) =>
                  setFelt(event.target.value as WorkoutFeedback['felt'])
                }
              >
                <option value="BETTER">Parempi</option>
                <option value="SAME">Sama</option>
                <option value="WORSE">Huonompi</option>
              </select>
            </label>
            <label className="field">
              <span>Kipu harjoituksen aikana</span>
              <select
                value={pain}
                onChange={(event) =>
                  setPain(event.target.value as WorkoutFeedback['pain'])
                }
              >
                <option value="NONE">Ei kipua</option>
                <option value="MILD">Lievä</option>
                <option value="MODERATE">Kohtalainen</option>
                <option value="SEVERE">Voimakas</option>
              </select>
            </label>
            <label className="field">
              <span>Kivun sijainti (valinnainen)</span>
              <input
                value={painLocation}
                onChange={(event) => setPainLocation(event.target.value)}
              />
            </label>
          </div>
          {(pain === 'MODERATE' || pain === 'SEVERE' || felt === 'WORSE') && (
            <div className="status-banner">
              Seuraavaa kovaa harjoitusta ei pidä edistää tämän palautteen perusteella.
              Jos kipu on voimakasta, uutta tai pahenee, hakeudu terveydenhuollon arvioon.
            </div>
          )}
          <label className="field">
            <span>Muistiinpanot</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="button-row">
            {canResumeWorkout(sessionLockReason) && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => showStage('EXECUTION')}
              >
                Takaisin harjoitukseen
              </button>
            )}
            <button className="button button-primary" disabled={pending}>
              {pending ? 'Tallennetaan…' : 'Tallenna harjoitus ja palaute'}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function ProgressionNotice({ decision }: { decision: WorkoutProgressionDecision }) {
  return (
    <div
      className={decision.action === 'REFER' ? 'status-banner danger' : 'status-banner'}
      role="status"
    >
      <strong>Edellisen harjoituksen palaute huomioitu.</strong> {decision.message}
    </div>
  )
}
