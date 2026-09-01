import { Link } from 'react-router-dom'
import { useAppData } from '../app-data/appDataContextValue'
import { activeTrainingPlan } from '../coaching/coachingActions'
import {
  planSessions,
  planStrengthWeek,
  sessionLabels,
  sessionTotalDurationMinutes,
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

const supportLabels = {
  SUPPORTED: 'Tuettu viikko',
  PARTIAL: 'Osittainen viikko',
  UNSUPPORTED: 'Viikkoa ei voida muodostaa tuettuna',
} as const

function totalCalculatedSets(volume: Record<string, number>) {
  return Object.values(volume).reduce((total, amount) => total + amount, 0)
}

export function WeekPage() {
  const data = useAppData()
  const plan = activeTrainingPlan(data)
  const sessions = planSessions(plan)
  const strengthWeek = planStrengthWeek(plan)
  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Viikkosuunnitelma</p>
          <h1>Tämä viikko</h1>
          <p>Kiinteät lajiharjoitukset ja kilpailut lasketaan aina kokonaiskuormaan.</p>
        </div>
        <div className="button-row">
          <Link className="button button-secondary" to="/laji">
            Lisää lajiharjoitus
          </Link>
        </div>
      </header>
      {strengthWeek && (
        <section
          className="surface-card strength-week-summary"
          aria-label="Voimaharjoittelun viikon yhteenveto"
        >
          <div>
            <p className="eyebrow">Voimaviikon rakenne</p>
            <h2>
              {strengthWeek.appSessionCount + strengthWeek.fixedStrengthExposureCount}/
              {strengthWeek.targetSessions} harjoitusta
            </h2>
          </div>
          <div
            className={`status-banner ${
              strengthWeek.status === 'SUPPORTED'
                ? 'status-banner-success'
                : 'status-banner-warning'
            }`}
            role="status"
          >
            <strong>{supportLabels[strengthWeek.status]}</strong>
            <p>
              {strengthWeek.supportDecision?.messageFi ??
                'Viikon tukitila perustuu muodostettuihin harjoituksiin ja turvallisiin rajoihin.'}
            </p>
            <p>
              <strong>Seuraava askel:</strong>{' '}
              {strengthWeek.supportDecision?.actionFi ??
                'Tarkista viikon harjoitukset ennen aloittamista.'}
            </p>
            {strengthWeek.status !== 'SUPPORTED' &&
              strengthWeek.supportDecision?.evidence && (
                <small>
                  Eniten käyttämätöntä aikaa yhdessä harjoituksessa{' '}
                  {Math.floor(
                    strengthWeek.supportDecision.evidence.remainingTimeSeconds / 60,
                  )}{' '}
                  min; pienimmän versionoidun lisäyksen aikakustannus vähintään{' '}
                  {strengthWeek.supportDecision.evidence.minimumPolicyAdditionSeconds} s.
                </small>
              )}
          </div>
          <p>
            Toteutunut ja suunniteltu volyymi lasketaan erikseen. Seitsemän vuorokauden
            lihaskohtainen katto huomioi myös viikon aiemmat harjoitukset.
          </p>
          <p>
            <strong>
              Toteutunut {totalCalculatedSets(strengthWeek.completedVolume)} · suunniteltu{' '}
              {totalCalculatedSets(strengthWeek.plannedVolume)} laskennallista lihassarjaa
            </strong>
          </p>
          {strengthWeek.reasonCodes.includes('PULL_PATTERN_EQUIPMENT_REQUIRED') && (
            <div className="status-banner" role="status">
              <strong>Vetävä liikesuunta tarvitsee välineen.</strong> Täysi
              kotivoimaohjelma tarvitsee vetoliikettä varten vähintään pitkän
              vastuskuminauhan tai muun Haukkarin tukeman välineen.
              <div className="button-row">
                <Link
                  className="button button-secondary"
                  to="/asetukset#harjoitusvalineet"
                >
                  Päivitä harjoitusvälineet
                </Link>
              </div>
            </div>
          )}
          {strengthWeek.missingMovementPatterns.length > 0 && (
            <p className="muted-copy">
              Vielä kattamatta: {strengthWeek.missingMovementPatterns.join(', ')}.
              Puutetta ei täytetä kielletyllä tai tukemattomalla liikkeellä.
            </p>
          )}
        </section>
      )}
      <section className="week-grid" aria-label="Viikon harjoitukset">
        {weekdays.map((day, index) => {
          const items = sessions.filter((session) => session.day === index + 1)
          return (
            <article className="week-day" key={day}>
              <header>
                <span>{index + 1}</span>
                <h2>{day}</h2>
              </header>
              {items.length === 0 ? (
                <p className="muted-copy">Lepo tai vapaa liike</p>
              ) : (
                items.map((session) => (
                  <Link
                    className={`session-block intensity-${session.intensity.toLocaleLowerCase('fi-FI')}`}
                    key={session.id}
                    to={`/viikko/${encodeURIComponent(session.id)}`}
                    aria-label={`Avaa ${session.title ?? sessionLabels[session.kind]}, ${day}, ennakkonäkymä`}
                  >
                    <strong>{session.title ?? sessionLabels[session.kind]}</strong>
                    <span>
                      {sessionTotalDurationMinutes(session)} min kokonaiskesto ·{' '}
                      {session.intensity === 'HARD'
                        ? 'kova'
                        : session.intensity === 'MODERATE'
                          ? 'kohtalainen'
                          : 'kevyt'}
                    </span>
                    <span className="session-block-action">Katso ohjelma</span>
                  </Link>
                ))
              )}
            </article>
          )
        })}
      </section>
      <p className="surface-card muted-copy">
        Väliin jäänyttä harjoitusta ei siirretä automaattisesti tuplakuormaksi. Tee
        seuraava suunniteltu harjoitus tai käytä kompaktia versiota.
      </p>
    </div>
  )
}
