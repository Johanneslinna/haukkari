import { Link } from 'react-router-dom'
import { useAppData } from '../app-data/appDataContextValue'
import { activeTrainingPlan } from '../coaching/coachingActions'
import { planSessions, sessionLabels } from '../coaching/coachingData'

const weekdays = [
  'Maanantai',
  'Tiistai',
  'Keskiviikko',
  'Torstai',
  'Perjantai',
  'Lauantai',
  'Sunnuntai',
]

export function WeekPage() {
  const data = useAppData()
  const sessions = planSessions(activeTrainingPlan(data))
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
                      {session.durationMinutes} min ·{' '}
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
