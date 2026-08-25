import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  evaluateWorkoutFeedback,
  type PrescribedSession,
  type WorkoutFeedback,
} from '../../domain/coaching'
import type { LocalRecord } from '../../domain/sync/types'
import { useAppData } from '../app-data/appDataContextValue'
import { fiDate, numberValue, objectValue, stringValue } from '../coaching/coachingData'

const completionLabels: Record<string, string> = {
  COMPLETED: 'Tehty suunnitelman mukaan',
  PARTIAL: 'Osa harjoituksesta tehty',
  STOPPED: 'Harjoitus keskeytetty',
}

const difficultyLabels: Record<string, string> = {
  TOO_EASY: 'Liian helppo',
  RIGHT: 'Sopiva',
  TOO_HARD: 'Liian raskas',
}

const painLabels: Record<string, string> = {
  NONE: 'Ei kipua',
  MILD: 'Lievä',
  MODERATE: 'Kohtalainen',
  SEVERE: 'Voimakas',
}

const feltLabels: Record<string, string> = {
  BETTER: 'Parempi',
  SAME: 'Sama',
  WORSE: 'Huonompi',
}

function findWorkout(data: ReturnType<typeof useAppData>, log: LocalRecord) {
  const workoutId = stringValue(log.data.workout_id)
  return data.list('workouts').find((record) => record.id === workoutId) ?? null
}

function prescriptionFrom(workout: LocalRecord | null) {
  const value = objectValue(workout?.data.prescription)
  return typeof value.id === 'string' && Array.isArray(value.exercises)
    ? (value as unknown as PrescribedSession)
    : null
}

function feedbackFrom(log: LocalRecord) {
  const value = objectValue(log.data.feedback)
  return typeof value.sessionRpe === 'number'
    ? (value as unknown as WorkoutFeedback)
    : null
}

function performedTime(log: LocalRecord) {
  const value = stringValue(log.data.performed_at, log.createdAt)
  return new Intl.DateTimeFormat('fi-FI', { timeStyle: 'short' }).format(new Date(value))
}

export function HistoryPage() {
  const data = useAppData()
  const { workoutLogId } = useParams()
  const logs = data
    .list('workout_logs')
    .filter((record) => record.data.completion_status !== 'IN_PROGRESS')
    .reverse()
  if (workoutLogId) {
    const log = logs.find((record) => record.id === workoutLogId)
    return log ? <HistoryDetail log={log} /> : <MissingHistoryEntry />
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Offline-tallennettu historia</p>
          <h1>Harjoitushistoria</h1>
          <p>
            Avaa harjoitus nähdäksesi suunnitellut liikkeet, toteutuneet sarjat ja oman
            palautteesi.
          </p>
        </div>
      </header>
      <section className="surface-card">
        {logs.length ? (
          <ul className="history-list list-reset">
            {logs.map((record) => {
              const workout = findWorkout(data, record)
              const feedback = feedbackFrom(record)
              const status = stringValue(
                record.data.completion_status,
                feedback?.completionStatus ?? 'COMPLETED',
              )
              return (
                <li key={record.id}>
                  <div className="history-date">
                    <strong>
                      {fiDate(stringValue(record.data.performed_at, record.createdAt))}
                    </strong>
                    <span>{performedTime(record)}</span>
                  </div>
                  <div>
                    <h2>{stringValue(workout?.data.title, 'Suunniteltu harjoitus')}</h2>
                    <p>
                      {numberValue(record.data.duration_minutes)} min · RPE{' '}
                      {numberValue(record.data.rpe).toLocaleString('fi-FI')} / 10
                    </p>
                    {feedback && (
                      <small>
                        {difficultyLabels[feedback.difficulty]} ·{' '}
                        {painLabels[feedback.pain]}
                      </small>
                    )}
                  </div>
                  <Link
                    className="history-open"
                    to={`/historia/${record.id}`}
                    aria-label={`Avaa ${stringValue(workout?.data.title, 'harjoitus')}`}
                  >
                    <span className="pill">{completionLabels[status] ?? 'Valmis'}</span>
                    <ChevronRight aria-hidden="true" size={20} />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="empty-state">
            Harjoitushistoria on vielä tyhjä. Ensimmäinen valmis harjoitus ilmestyy tänne.
          </div>
        )}
      </section>
    </div>
  )
}

function HistoryDetail({ log }: { log: LocalRecord }) {
  const data = useAppData()
  const workout = findWorkout(data, log)
  const prescription = prescriptionFrom(workout)
  const feedback = feedbackFrom(log)
  const feedbackDecision = evaluateWorkoutFeedback(
    data
      .list('workout_logs')
      .filter(
        (record) =>
          record.data.completion_status !== 'IN_PROGRESS' &&
          stringValue(record.data.performed_at, record.createdAt) <=
            stringValue(log.data.performed_at, log.createdAt),
      )
      .sort((left, right) =>
        stringValue(left.data.performed_at, left.createdAt).localeCompare(
          stringValue(right.data.performed_at, right.createdAt),
        ),
      )
      .map(feedbackFrom)
      .filter((value): value is WorkoutFeedback => value !== null),
    prescription?.exercises.map((exercise) => exercise.code),
  ).decision
  const setLogs = data
    .list('exercise_set_logs')
    .filter((record) => record.data.workout_log_id === log.id)
  const completedSets = setLogs.filter(
    (record) => objectValue(record.data.data).completed === true,
  ).length
  const plannedSets = prescription?.exercises.reduce(
    (total, exercise) => total + exercise.sets,
    0,
  )
  const status = stringValue(
    log.data.completion_status,
    feedback?.completionStatus ?? 'COMPLETED',
  )

  return (
    <div className="page-stack history-detail-page">
      <Link className="back-link" to="/historia">
        <ArrowLeft aria-hidden="true" size={18} /> Takaisin historiaan
      </Link>
      <header className="section-heading">
        <div>
          <p className="eyebrow">
            {fiDate(stringValue(log.data.performed_at, log.createdAt))} ·{' '}
            {performedTime(log)}
          </p>
          <h1>{stringValue(workout?.data.title, 'Suunniteltu harjoitus')}</h1>
          <p>Suunnitelma ja toteuma säilyvät samassa harjoitusmerkinnässä.</p>
        </div>
        <span className="state-pill">{completionLabels[status] ?? 'Valmis'}</span>
      </header>

      <section className="history-summary-grid">
        <div className="surface-card metric-card">
          <span>Kesto</span>
          <strong>{numberValue(log.data.duration_minutes)} min</strong>
          <p>Kirjattu toteuma</p>
        </div>
        <div className="surface-card metric-card">
          <span>Kuormittavuus</span>
          <strong>RPE {numberValue(log.data.rpe)}</strong>
          <p>0 = lepo, 10 = maksimaalinen</p>
        </div>
        <div className="surface-card metric-card">
          <span>Sarjat</span>
          <strong>
            {completedSets}/{plannedSets ?? setLogs.length}
          </strong>
          <p>Valmiiksi merkityt / suunnitellut</p>
        </div>
      </section>

      <section className="surface-card">
        <p className="eyebrow">Suunnitelma verrattuna toteumaan</p>
        <h2>Liikkeet ja sarjat</h2>
        {prescription ? (
          <ol className="history-exercise-list">
            {prescription.exercises.map((exercise) => {
              const actual = setLogs.filter(
                (record) =>
                  stringValue(objectValue(record.data.data).exercise_id) === exercise.id,
              )
              return (
                <li key={exercise.id}>
                  <div className="history-exercise-heading">
                    <div>
                      <h3>{exercise.nameFi}</h3>
                      <p>
                        Suunnitelma: {exercise.sets} ×{' '}
                        {exercise.repetitions ??
                          `${Math.round((exercise.durationSeconds ?? 0) / 60)} min`}{' '}
                        · RPE {exercise.targetRpe}
                      </p>
                    </div>
                    <span className="pill">
                      {
                        actual.filter(
                          (record) => objectValue(record.data.data).completed === true,
                        ).length
                      }
                      /{exercise.sets} sarjaa
                    </span>
                  </div>
                  {actual.length > 0 && (
                    <div className="history-set-list">
                      {actual.map((record, index) => (
                        <span key={record.id}>
                          {index + 1}. sarja:{' '}
                          {objectValue(record.data.data).completed === true
                            ? 'valmis'
                            : 'ei valmis'}
                          {typeof record.data.repetitions === 'number'
                            ? ` · ${record.data.repetitions} toistoa`
                            : ''}
                          {setLoadLabel(record)}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="empty-state">
            Tämä merkintä on tehty ennen yksityiskohtaista harjoituslokia, joten
            liikesuunnitelmaa ei ole saatavilla.
          </div>
        )}
      </section>

      <section className="surface-card progression-result-card">
        <p className="eyebrow">Vaikutus seuraavaan harjoitukseen</p>
        <h2>{progressionHeading(feedbackDecision.action)}</h2>
        <p>{progressionExplanation(feedbackDecision, feedback)}</p>
        <small>Pitkän aikavälin tavoitteesi säilyy ennallaan.</small>
      </section>

      <section className="surface-card">
        <p className="eyebrow">Oma palaute</p>
        <h2>Miltä harjoitus tuntui?</h2>
        {feedback ? (
          <div className="feedback-summary-grid">
            <div>
              <span>Vaikeustaso</span>
              <strong>{difficultyLabels[feedback.difficulty]}</strong>
            </div>
            <div>
              <span>Kipu</span>
              <strong>{painLabels[feedback.pain]}</strong>
            </div>
            <div>
              <span>Olo jälkeen</span>
              <strong>{feltLabels[feedback.felt]}</strong>
            </div>
            {feedback.painLocation && (
              <div>
                <span>Kivun sijainti</span>
                <strong>{feedback.painLocation}</strong>
              </div>
            )}
            {feedback.notes && (
              <div className="feedback-note">
                <span>Muistiinpano</span>
                <p>{feedback.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="muted-copy">
            Tähän vanhempaan merkintään ei ole tallennettu erillistä palautetta.
          </p>
        )}
      </section>

      {prescription && (
        <details className="surface-card decision-details">
          <summary>Miksi tämä harjoitus valittiin ennen aloittamista?</summary>
          <ul>
            {prescription.decisionTrace.rules
              .filter((rule) => rule.ruleId !== 'FEEDBACK-NONE-001')
              .map((rule) => (
                <li key={rule.ruleId}>{rule.message}</li>
              ))}
          </ul>
          <details className="technical-details">
            <summary>Tekniset tiedot tukea varten</summary>
            <p>
              Sääntöversio {prescription.decisionTrace.ruleVersion} · turvallisuustulos{' '}
              {safetyOutcomeLabel(prescription.decisionTrace.safetyOutcome)}
            </p>
          </details>
        </details>
      )}
    </div>
  )
}

function setLoadLabel(record: LocalRecord) {
  const details = objectValue(record.data.data)
  if (typeof details.load_text === 'string' && details.load_text.trim()) {
    const type = stringValue(details.load_type)
    const suffix =
      type === 'BAND'
        ? ' nauha'
        : type === 'DUMBBELL_KG_EACH'
          ? ' kg / käsipaino'
          : type === 'MACHINE_KG' || type === 'EXTERNAL_KG'
            ? ' kg'
            : ''
    return ` · ${details.load_text}${suffix}`
  }
  return typeof record.data.load_kg === 'number'
    ? ` · ${record.data.load_kg.toLocaleString('fi-FI')} kg`
    : ''
}

function progressionExplanation(
  decision: ReturnType<typeof evaluateWorkoutFeedback>['decision'],
  feedback: WorkoutFeedback | null,
) {
  if (!feedback) return decision.message
  if (feedback.pain === 'SEVERE') {
    return 'Kirjasit voimakasta kipua. Harjoittelua ei edistetä, ja oire pitää arvioida ennen kuormittavan harjoittelun jatkamista.'
  }
  if (feedback.pain === 'MODERATE' || feedback.felt === 'WORSE') {
    return 'Kirjasit kohtalaista kipua tai harjoituksen jälkeisen olon huonontuneen. Seuraava kuormittava harjoitus korvataan palauttavalla vaihtoehdolla.'
  }
  if (feedback.sessionRpe >= 9) {
    return `Arvioit koko harjoituksen kuormittavuudeksi RPE ${feedback.sessionRpe}/10. Seuraavassa vastaavassa harjoituksessa jokaisesta liikkeestä vähennetään yksi sarja ja sarjojen tavoite-RPE:tä lasketaan yhdellä.`
  }
  if (feedback.completionStatus === 'PARTIAL' || feedback.difficulty === 'TOO_HARD') {
    return 'Harjoitus jäi osittaiseksi tai tuntui liian raskaalta. Seuraavan vastaavan harjoituksen sarjamäärää ja tavoite-RPE:tä pienennetään.'
  }
  return decision.message
}

function safetyOutcomeLabel(value: string) {
  if (value === 'MODIFY') return 'mukautettu'
  if (value === 'STOP') return 'pysäytetty'
  if (value === 'REFER') return 'arvio suositeltu'
  return 'harjoitus voitiin toteuttaa'
}

function progressionHeading(action: string) {
  if (action === 'PROGRESS_LOAD') return 'Maltillinen eteneminen'
  if (action === 'REDUCE_LOAD') return 'Seuraava annos kevenee'
  if (action === 'RECOVERY') return 'Seuraavaksi palauttava vaihtoehto'
  if (action === 'REFER') return 'Kova harjoittelu odottaa arviota'
  return 'Nykyinen annos säilyy'
}

function MissingHistoryEntry() {
  return (
    <div className="page-stack narrow-page">
      <section className="surface-card empty-state">
        <h1>Harjoitusta ei löytynyt</h1>
        <Link className="button button-secondary" to="/historia">
          Takaisin historiaan
        </Link>
      </section>
    </div>
  )
}
