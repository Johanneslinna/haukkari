import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CloudOff,
  Dumbbell,
  HeartPulse,
  ListChecks,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type {
  GoalType,
  PlannedSession,
  ReadinessState,
} from '../../domain/coaching/types'
import { useAppData } from '../app-data/appDataContextValue'
import { activeGoalRecord, activeTrainingPlan } from '../coaching/coachingActions'
import {
  goalLabels,
  numberValue,
  planSessions,
  sessionLabels,
  stringValue,
  todayIso,
} from '../coaching/coachingData'
import { useSync } from '../sync/syncContextValue'

const shortWeekdays = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']

function localIso(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekDates() {
  const today = new Date()
  const weekday = today.getDay() || 7
  const monday = new Date(today)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(today.getDate() - weekday + 1)
  return shortWeekdays.map((label, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return { label, iso: localIso(date), date: date.getDate() }
  })
}

function greeting(now: Date) {
  const hour = now.getHours()
  if (hour < 11) return 'Hyvää huomenta'
  if (hour < 18) return 'Hyvää päivää'
  return 'Hyvää iltaa'
}

function todayDateLabel(now: Date) {
  return new Intl.DateTimeFormat('fi-FI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
}

function titleFor(session: PlannedSession | undefined) {
  if (!session) return 'Päivän harjoitus odottaa suunnitelmaa'
  return session.title ?? sessionLabels[session.kind]
}

function readinessContent(
  readiness: ReadinessState | undefined,
  hasCheckIn: boolean,
  hasSession: boolean,
  complete: boolean,
) {
  if (complete)
    return {
      key: 'complete',
      label: 'Päivän harjoitus tehty',
      reason: 'Harjoitus on kirjattu. Loppupäivä saa nyt tukea palautumista.',
    }
  if (!hasSession)
    return {
      key: 'empty',
      label: 'Suunnitelma puuttuu',
      reason:
        'Päivän harjoitusta ei ole vielä muodostettu. Avaa viikko ja viimeistele suunnitelma ennen aloittamista.',
    }
  if (!hasCheckIn)
    return {
      key: 'pending',
      label: 'Kuntotarkistus odottaa',
      reason:
        'Lyhyt kuntotarkistus varmistaa päivän turvallisen version ennen aloitusta.',
    }
  if (readiness === 'YELLOW')
    return {
      key: 'light',
      label: 'Kevyempi päivä',
      reason: 'Päivän määrää on kevennetty kuntotarkistuksen perusteella.',
    }
  if (readiness === 'ORANGE_RECOVERY')
    return {
      key: 'recovery',
      label: 'Palautuminen etusijalla',
      reason:
        'Palauttava versio sopii tämän päivän vointiin kuormittavaa harjoitusta paremmin.',
    }
  if (readiness === 'RED_STOP')
    return {
      key: 'blocked',
      label: 'Harjoittelua ei suositella',
      reason:
        'Ilmoitettu turvallisuusoire estää harjoituksen. Lopeta kuormitus ja noudata alla olevaa toimintaohjetta.',
    }
  return {
    key: 'normal',
    label: 'Valmis harjoitukseen',
    reason: 'Kuntotarkistus tukee suunnitelman mukaista harjoitusta tänään.',
  }
}

function compactDuration(
  session: PlannedSession | undefined,
  readiness?: ReadinessState,
) {
  if (!session) return 0
  const preferred = readiness === 'YELLOW' ? 'LIGHT' : 'FULL'
  return (
    session.variants?.find((variant) => variant.kind === preferred)?.durationMinutes ??
    session.durationMinutes
  )
}

export function TodayPage() {
  const data = useAppData()
  const { status } = useSync()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (data.loading) return <TodayLoading />

  const profile = data.latest('profiles')
  const goalRecord = activeGoalRecord(data)
  const goal = stringValue(goalRecord?.data.primary_goal, 'GENERAL_FITNESS') as GoalType
  const plan = activeTrainingPlan(data)
  const sessions = planSessions(plan)
  const weekday = new Date().getDay() || 7
  const todaySession = sessions.find((session) => session.day === weekday)
  const checkIn = data
    .list('daily_checkins')
    .find((record) => record.data.checkin_date === todayIso())
  const readiness = stringValue(checkIn?.data.readiness) as ReadinessState | undefined
  const screeningReviewRequired =
    data.latest('health_screenings')?.data.status === 'NEEDS_REVIEW'
  const workoutLogs = data
    .list('workout_logs')
    .filter((record) => record.data.completion_status !== 'IN_PROGRESS')
  const completedToday = workoutLogs.some(
    (record) => stringValue(record.data.performed_at).slice(0, 10) === todayIso(),
  )
  const completedThisWeek = weekDates().filter(({ iso }) =>
    workoutLogs.some(
      (record) => stringValue(record.data.performed_at).slice(0, 10) === iso,
    ),
  ).length
  const state = screeningReviewRequired
    ? {
        key: 'blocked',
        label: 'Harjoittelu odottaa oireen arviota',
        reason:
          'Aloituskartoituksessa ilmoitettu selvittämätön tai rasitukseen liittyvä varoitusoire estää harjoittelun.',
      }
    : readinessContent(readiness, Boolean(checkIn), Boolean(todaySession), completedToday)
  const duration = compactDuration(todaySession, readiness)
  const movementCount = todaySession?.prescription?.length ?? 0
  const quickLink = checkIn ? '/harjoitus?versio=10' : '/kuntotarkistus'
  const plannedThisWeek = sessions.filter(
    (session) => session.kind !== 'REST' && session.durationMinutes > 0,
  ).length

  return (
    <div className={`page-stack today-page today-state-${state.key}`}>
      <header className="today-heading">
        <div>
          <p className="eyebrow">{todayDateLabel(now)}</p>
          <h1>
            {greeting(now)}, {stringValue(profile?.data.display_name, 'sinä')}
          </h1>
          <p>Tässä on tämän päivän selkeä seuraava askel.</p>
        </div>
        <div className="today-heading-badges">
          <span className="goal-badge">
            <Target aria-hidden="true" size={15} />
            {goalLabels[goal]}
          </span>
          <SyncBadge state={status.state} />
        </div>
      </header>

      <SyncMessage state={status.state} errorMessage={status.errorMessage} />

      <div className="today-dashboard">
        <section className="today-hero" aria-labelledby="today-workout-title">
          {state.key !== 'blocked' && (
            <div className="hero-landscape" aria-hidden="true">
              <span className="hero-sun" />
              <span className="hero-horizon" />
              <span className="hero-path" />
              <span className="hero-wing hero-wing-left" />
              <span className="hero-wing hero-wing-right" />
            </div>
          )}
          <div className="today-hero-content">
            <p className="today-status-label">
              <StatusIcon state={state.key} />
              {state.label}
            </p>
            <p className="eyebrow">Päivän harjoitus</p>
            <h2 id="today-workout-title">{titleFor(todaySession)}</h2>

            {todaySession && (
              <div className="workout-meta" aria-label="Harjoituksen tiedot">
                <span>
                  <Clock3 aria-hidden="true" size={18} />
                  {duration} min
                </span>
                <span>
                  <ListChecks aria-hidden="true" size={18} />
                  {movementCount > 0
                    ? `${movementCount} ${movementCount === 1 ? 'osio' : 'osiota'}`
                    : 'Rakenne valmiina'}
                </span>
              </div>
            )}

            <p className="today-reason">{state.reason}</p>

            <HeroActions
              state={state.key}
              hasCheckIn={Boolean(checkIn)}
              hasSession={Boolean(todaySession)}
              quickLink={quickLink}
              screeningReviewRequired={screeningReviewRequired}
            />
          </div>
        </section>

        <aside className="today-support-rail" aria-label="Päivän tilanne">
          <DayStatus state={state.key} />
          <ProgressSummary
            completed={completedThisWeek}
            planned={plannedThisWeek}
            goal={goal}
            distance={data
              .list('run_logs')
              .reduce((sum, record) => sum + numberValue(record.data.distance_km), 0)}
          />
          <NextWeek sessions={sessions} />
        </aside>

        <WeekRhythm
          logs={workoutLogs.map((record) => stringValue(record.data.performed_at))}
        />
      </div>
    </div>
  )
}

function StatusIcon({ state }: { state: string }) {
  const Icon =
    state === 'blocked'
      ? ShieldAlert
      : state === 'complete'
        ? CheckCircle2
        : state === 'recovery'
          ? HeartPulse
          : state === 'light'
            ? Sparkles
            : Dumbbell
  return <Icon aria-hidden="true" size={18} strokeWidth={2.4} />
}

function SyncBadge({ state }: { state: string }) {
  if (state !== 'SYNCED' && state !== 'SYNCING') return null
  const syncing = state === 'SYNCING'
  const Icon = syncing ? LoaderCircle : CheckCircle2
  return (
    <span
      className={`today-sync-badge${syncing ? ' is-syncing' : ''}`}
      role="status"
      aria-live="polite"
    >
      <Icon aria-hidden="true" size={15} />
      {syncing ? 'Tallennetaan muutoksia…' : 'Tiedot turvassa'}
    </span>
  )
}

function HeroActions({
  state,
  hasCheckIn,
  hasSession,
  quickLink,
  screeningReviewRequired,
}: {
  state: string
  hasCheckIn: boolean
  hasSession: boolean
  quickLink: string
  screeningReviewRequired: boolean
}) {
  if (state === 'blocked') {
    return (
      <div className="safety-action" role="alert">
        <strong>Turvallinen seuraava askel</strong>
        <p>
          Älä aloita harjoitusta. Jos oire on uusi, voimakas tai huolestuttava, hakeudu
          asianmukaiseen arvioon.
        </p>
        <Link
          className="button button-secondary"
          to={screeningReviewRequired ? '/tiedot' : '/kuntotarkistus'}
        >
          {screeningReviewRequired
            ? 'Hallitse terveystietoja'
            : 'Tarkista ilmoittamasi oireet'}
          <ChevronRight aria-hidden="true" size={18} />
        </Link>
      </div>
    )
  }

  if (state === 'complete') {
    return (
      <div className="today-hero-actions">
        <Link className="button button-primary" to="/historia">
          <Check aria-hidden="true" size={19} />
          Katso toteuma
        </Link>
        <Link className="button button-secondary" to="/viikko">
          Katso loppuviikko
        </Link>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="today-hero-actions">
        <Link className="button button-primary" to="/viikko">
          <CalendarDays aria-hidden="true" size={19} />
          Avaa viikkosuunnitelma
        </Link>
      </div>
    )
  }

  return (
    <div className="today-hero-actions">
      <Link
        className="button button-primary today-primary-action"
        to={hasCheckIn ? '/harjoitus' : '/kuntotarkistus'}
      >
        <Play aria-hidden="true" size={20} fill="currentColor" />
        Aloita treeni
      </Link>
      <Link className="button button-secondary today-quick-action" to={quickLink}>
        <Zap aria-hidden="true" size={18} />
        10 min pikatreeni
      </Link>
      {!hasCheckIn && (
        <small className="action-note">
          Aloitus sisältää ensin 30 sekunnin kuntotarkistuksen.
        </small>
      )}
    </div>
  )
}

function SyncMessage({
  state,
  errorMessage,
}: {
  state: string
  errorMessage: string | null
}) {
  if (state !== 'OFFLINE' && state !== 'ERROR' && state !== 'CONFLICT') return null
  const offline = state === 'OFFLINE'
  const Icon = offline ? CloudOff : CircleAlert
  return (
    <div
      className={`today-sync-message ${offline ? 'is-offline' : 'is-error'}`}
      role={offline ? 'status' : 'alert'}
      aria-live={offline ? 'polite' : 'assertive'}
    >
      <Icon aria-hidden="true" size={20} />
      <div>
        <strong>
          {offline ? 'Olet offline-tilassa' : 'Synkronointi vaatii huomiota'}
        </strong>
        <span>
          {offline
            ? 'Voit jatkaa normaalisti. Muutokset tallentuvat tälle laitteelle.'
            : errorMessage ||
              'Tietoja ei saatu juuri nyt synkronoitua. Paikalliset tiedot säilyvät.'}
        </span>
      </div>
      {!offline && (
        <Link to="/synkronointi">
          Tarkista
          <ChevronRight aria-hidden="true" size={17} />
        </Link>
      )}
    </div>
  )
}

function DayStatus({ state }: { state: string }) {
  const content =
    state === 'blocked'
      ? ['Harjoitus pysäytetty', 'Turvallisuusohje on päivän tärkein tehtävä.']
      : state === 'complete'
        ? ['Tämän päivän työ tehty', 'Toteuma on tallennettu harjoitushistoriaan.']
        : state === 'recovery'
          ? ['Kuormaa on vähennetty', 'Kevyt liike ja palautuminen riittävät tänään.']
          : state === 'light'
            ? ['Suunnitelmaa on kevennetty', 'Tavoite säilyy, päivän määrä joustaa.']
            : ['Päivä on hallinnassa', 'Harjoitus ja vaihtoehdot ovat valmiina.']
  return (
    <section className={`today-rail-section day-status status-${state}`}>
      <p className="eyebrow">Päivän tila</p>
      <StatusIcon state={state} />
      <h2>{content[0]}</h2>
      <p>{content[1]}</p>
    </section>
  )
}

function ProgressSummary({
  completed,
  planned,
  goal,
  distance,
}: {
  completed: number
  planned: number
  goal: GoalType
  distance: number
}) {
  const usesDistance = goal === 'ENDURANCE' && distance > 0
  return (
    <section className="today-rail-section progress-summary">
      <p className="eyebrow">Edistyminen</p>
      <h2>Tämän viikon työ</h2>
      <div className="progress-number">
        <strong>{completed}</strong>
        <span>/ {planned || '—'} harjoitusta</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Viikon toteutuneet harjoitukset"
        aria-valuemin={0}
        aria-valuemax={Math.max(planned, 1)}
        aria-valuenow={Math.min(completed, Math.max(planned, 1))}
      >
        <span
          style={{
            width: `${planned ? Math.min(100, (completed / planned) * 100) : 0}%`,
          }}
        />
      </div>
      <p className="goal-context">
        <Target aria-hidden="true" size={16} />
        {usesDistance
          ? `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 1 }).format(distance)} km kirjattu`
          : goalLabels[goal]}
      </p>
    </section>
  )
}

function NextWeek({ sessions }: { sessions: PlannedSession[] }) {
  const first = [...sessions]
    .filter((session) => session.kind !== 'REST' && session.durationMinutes > 0)
    .sort((left, right) => left.day - right.day)[0]
  const count = sessions.filter(
    (session) => session.kind !== 'REST' && session.durationMinutes > 0,
  ).length
  return (
    <section className="today-rail-section next-week">
      <p className="eyebrow">Ensi viikolla</p>
      <h2>{count ? `${count} harjoituksen rytmi` : 'Suunnitelma odottaa'}</h2>
      <p>
        {first
          ? `Viikko alkaa harjoituksella: ${first.title ?? sessionLabels[first.kind]}.`
          : 'Muodosta viikkosuunnitelma, jotta näet seuraavan rytmin.'}
      </p>
      <Link to="/viikko">
        Katso viikko
        <ChevronRight aria-hidden="true" size={17} />
      </Link>
    </section>
  )
}

function WeekRhythm({ logs }: { logs: string[] }) {
  const days = weekDates()
  return (
    <section className="week-rhythm" aria-labelledby="week-rhythm-title">
      <div className="week-rhythm-heading">
        <div>
          <p className="eyebrow">Viikon rytmi</p>
          <h2 id="week-rhythm-title">Tasainen tekeminen riittää</h2>
        </div>
        <Link to="/viikko">
          Koko viikko
          <ChevronRight aria-hidden="true" size={17} />
        </Link>
      </div>
      <ol className="rhythm-days">
        {days.map((day) => {
          const complete = logs.some((value) => value.slice(0, 10) === day.iso)
          const current = day.iso === todayIso()
          return (
            <li
              className={`${complete ? 'is-complete' : ''}${current ? ' is-today' : ''}`}
              key={day.iso}
            >
              <span>{day.label}</span>
              <strong>{day.date}</strong>
              <i aria-hidden="true">{complete ? <Check size={16} /> : null}</i>
              <span className="sr-only">
                {complete
                  ? 'Harjoitus tehty'
                  : current
                    ? 'Tänään'
                    : 'Ei kirjattua harjoitusta'}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function TodayLoading() {
  return (
    <div className="page-stack today-page today-loading" role="status" aria-live="polite">
      <span className="sr-only">Ladataan päivän harjoitusta</span>
      <header className="today-heading" aria-hidden="true">
        <div>
          <span className="skeleton skeleton-line skeleton-short" />
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-line" />
        </div>
      </header>
      <div className="today-dashboard" aria-hidden="true">
        <section className="today-hero loading-hero">
          <div className="today-hero-content">
            <RefreshCw className="loading-spinner" size={24} />
            <span className="skeleton skeleton-line skeleton-short" />
            <span className="skeleton skeleton-display" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-button" />
          </div>
        </section>
        <aside className="today-support-rail">
          <section className="today-rail-section">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
          </section>
        </aside>
      </div>
    </div>
  )
}
