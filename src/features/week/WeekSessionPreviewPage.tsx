import { Link, useParams } from 'react-router-dom'
import { doseLabelFi } from '../../domain/coaching'
import { useAppData } from '../app-data/appDataContextValue'
import { activeTrainingPlan } from '../coaching/coachingActions'
import {
  calendarContextForProfile,
  planSessions,
  planStrengthWeek,
  sessionLabels,
} from '../coaching/coachingData'

const weekdays = [
  'Maanantai',
  'Tiistai',
  'Keskiviikko',
  'Torstai',
  'Perjantai',
  'Lauantai',
  'Sunnuntai',
]

const intensityLabels = {
  EASY: 'Kevyt',
  MODERATE: 'Kohtalainen',
  HARD: 'Kova',
} as const

const variantLabels = {
  FULL: 'Täysi harjoitus',
  LIGHT: 'Kevennetty harjoitus',
  COMPACT_10: '10 minuutin pikaversio',
  COMPACT_20: '20 minuutin kompakti versio',
  COMPACT_30: '30 minuutin kompakti versio',
} as const

export function WeekSessionPreviewPage() {
  const data = useAppData()
  const { sessionId = '' } = useParams()
  const clock = calendarContextForProfile(data.latest('profiles'))
  const activePlan = activeTrainingPlan(data)
  const weekDecision = planStrengthWeek(activePlan)
  const session = planSessions(activePlan).find((candidate) => candidate.id === sessionId)

  if (!session) {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Viikkosuunnitelma</p>
            <h1>Harjoitusta ei löytynyt</h1>
            <p>Suunnitelma on voinut päivittyä tämän näkymän avaamisen jälkeen.</p>
          </div>
        </header>
        <Link className="button button-secondary" to="/viikko">
          Takaisin viikkosuunnitelmaan
        </Link>
      </div>
    )
  }

  const prescription = session.prescriptionDetail
  const strengthWeek = session.strengthWeekContext
  const title = session.title ?? sessionLabels[session.kind]
  const isToday = session.day === clock.weekday

  return (
    <div className="page-stack workout-page week-session-preview">
      <header className="section-heading workout-heading">
        <div>
          <p className="eyebrow">Harjoituksen ennakkonäkymä</p>
          <h1>{title}</h1>
          <p>
            {weekdays[session.day - 1]} · {session.durationMinutes} min ·{' '}
            {intensityLabels[session.intensity]}
          </p>
        </div>
        <Link className="button button-secondary" to="/viikko">
          Takaisin viikkoon
        </Link>
      </header>

      <div className="status-banner preview-notice" role="status">
        <strong>Tämä on ennakkonäkymä.</strong> Ohjelman katsominen ei käynnistä
        harjoitusta eikä merkitse sitä suoritetuksi.
      </div>

      {weekDecision && (
        <section
          className={`status-banner ${
            weekDecision.status === 'SUPPORTED'
              ? 'status-banner-success'
              : 'status-banner-warning'
          }`}
          aria-label="Voimaviikon tukitila"
        >
          <strong>
            {weekDecision.status === 'SUPPORTED'
              ? 'Viikko on tuettu.'
              : weekDecision.status === 'PARTIAL'
                ? 'Viikko on osittainen.'
                : 'Viikkoa ei voida muodostaa tuettuna.'}
          </strong>
          <p>{weekDecision.supportDecision?.messageFi}</p>
          <p>
            <strong>Seuraava askel:</strong> {weekDecision.supportDecision?.actionFi}
          </p>
          {weekDecision.supportDecision?.reasonCode ===
            'PULL_PATTERN_EQUIPMENT_REQUIRED' && (
            <Link className="button button-secondary" to="/asetukset#harjoitusvalineet">
              Päivitä harjoitusvälineet
            </Link>
          )}
        </section>
      )}

      {strengthWeek && (
        <section className="surface-card">
          <p className="eyebrow">
            Voimaviikon harjoitus {strengthWeek.sequenceIndex + 1}
          </p>
          <h2>{strengthWeek.role.replaceAll('_', ' ')}</h2>
          <p>
            Tämä sama versionoitu harjoitusrunko avautuu suoritukseen. Päivän
            kuntotarkistus voi vain keventää, lyhentää tai estää sen ja kertoo silloin
            muutoksen syyn.
          </p>
          {session.notes?.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      )}

      {session.variants && session.variants.length > 0 && (
        <section className="surface-card">
          <p className="eyebrow">Käytettävissä olevat versiot</p>
          <div className="preview-variant-list" aria-label="Harjoituksen versiot">
            {session.variants.map((variant) => (
              <span key={variant.kind}>
                <strong>{variantLabels[variant.kind]}</strong>
                <small>{variant.durationMinutes} min</small>
              </span>
            ))}
          </div>
          <p className="muted-copy">
            Päivän kuntotarkistus suosittelee näistä vointiin ja käytettävissä olevaan
            aikaan sopivaa versiota.
          </p>
        </section>
      )}

      <section className="surface-card workout-plan-card">
        <div className="workout-plan-intro">
          <div>
            <p className="eyebrow">Suunniteltu ohjelma</p>
            <h2>Liikkeet, sarjat ja kuormitus</h2>
          </div>
          {prescription && (
            <span className="state-pill">{prescription.exercises.length} liikettä</span>
          )}
        </div>

        {prescription ? (
          <>
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
                        <span>{exercise.restSeconds} s palautus suoritusten välissä</span>
                      )}
                      <span>RPE {exercise.targetRpe}/10</span>
                    </div>
                    <small className="preview-load-guidance">
                      Kuorma: {exercise.loadGuidance}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            <div className="warmup-strip">
              <strong>Loppuverryttely</strong>
              <span>{prescription.cooldown.join(' · ')}</span>
            </div>
            <details className="decision-details">
              <summary>Miksi tämä harjoitus on suunnitelmassa?</summary>
              <ul>
                {prescription.decisionTrace.rules.map((rule) => (
                  <li key={rule.ruleId}>{rule.message}</li>
                ))}
              </ul>
              <p>{prescription.progression}</p>
            </details>
          </>
        ) : session.unsupportedPrescription ? (
          <div className="page-stack compact-stack status-banner status-banner-warning">
            <strong>Harjoitusta ei voitu muodostaa turvallisesti.</strong>
            <p>{session.unsupportedPrescription.userMessage}</p>
            <small>
              Syy: {session.unsupportedPrescription.reasonCode.replaceAll('_', ' ')}
            </small>
          </div>
        ) : (
          <div className="page-stack compact-stack">
            <p>
              Tämä on kiinteä laji- tai kilpailuharjoitus. Noudata valmentajan tai
              tapahtuman omaa ohjelmaa.
            </p>
            {session.prescription && session.prescription.length > 0 && (
              <ul className="prescription-list">
                {session.prescription.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {session.notes && session.notes.length > 0 && (
              <ul className="prescription-list">
                {session.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="surface-card preview-actions">
        {isToday ? (
          <>
            <div>
              <strong>Harjoitus on suunniteltu tälle päivälle.</strong>
              <p>Kuntotarkistus varmistaa päivän turvallisen version ennen aloitusta.</p>
            </div>
            <Link className="button button-primary" to="/kuntotarkistus">
              Siirry kuntotarkistukseen
            </Link>
          </>
        ) : (
          <div>
            <strong>Voit tutustua ohjelmaan etukäteen.</strong>
            <p>Harjoituksen käynnistys tulee näkyviin sen omana harjoituspäivänä.</p>
          </div>
        )}
      </section>
    </div>
  )
}
