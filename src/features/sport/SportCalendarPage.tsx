import { useState, type FormEvent } from 'react'
import { getSportAdapter, listFullySupportedDisciplines } from '../../domain/coaching'
import { useAppData } from '../app-data/appDataContextValue'
import { addCompetition, addFixedSportSession } from '../coaching/coachingActions'
import { fiDate, objectValue, stringValue } from '../coaching/coachingData'

const sportLabels: Record<string, string> = {
  'running-5k': 'Juoksu 5 km',
  'running-10k': 'Juoksu 10 km',
  'running-half-marathon': 'Puolimaraton',
  'running-marathon': 'Maraton',
  'trail-running': 'Polkujuoksu',
  'road-cycling': 'Maantiepyöräily',
  'gravel-cycling': 'Gravel-pyöräily',
  'mountain-biking': 'Maastopyöräily',
  'powerlifting-squat': 'Voimanosto – kyykky',
  'powerlifting-bench-press': 'Voimanosto – penkkipunnerrus',
  'powerlifting-deadlift': 'Voimanosto – maastaveto',
  'powerlifting-competition': 'Voimanostokilpailu',
}

export function SportCalendarPage() {
  const data = useAppData()
  const [sportCode, setSportCode] = useState('running-10k')
  const [customSport, setCustomSport] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [rpe, setRpe] = useState(6)
  const [coachDefined, setCoachDefined] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [priority, setPriority] = useState<'A' | 'B' | 'TRAINING'>('A')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const selectedSport = sportCode === 'other' ? customSport.trim() : sportCode
  const adapter = getSportAdapter(selectedSport)

  const saveSession = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setMessage('')
    try {
      await addFixedSportSession(data, {
        sportCode: selectedSport,
        startsAt,
        durationMinutes,
        rpe,
        coachDefined,
      })
      setMessage('Lajiharjoitus tallennettiin ja lasketaan kokonaiskuormaan.')
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : 'Harjoitusta ei voitu tallentaa.',
      )
    } finally {
      setPending(false)
    }
  }

  const saveEvent = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setMessage('')
    try {
      await addCompetition(data, { name: eventName, startsAt: eventDate, priority })
      setMessage('Tapahtuma tallennettiin kilpailukalenteriin.')
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : 'Tapahtumaa ei voitu tallentaa.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Kokonaiskuorma</p>
          <h1>Laji ja kilpailut</h1>
          <p>
            Valmentajan harjoitukset, lajikerrat ja tapahtumat ohittavat sovelluksen
            lisäharjoitteet.
          </p>
        </div>
      </header>
      {adapter.adapter.warning && (
        <p className="form-error general-support-warning">{adapter.adapter.warning}</p>
      )}
      <section className="two-column-grid align-start">
        <form className="surface-card form" onSubmit={saveSession}>
          <p className="eyebrow">Kiinteä harjoitus</p>
          <h2>Lisää lajiharjoitus</h2>
          <label className="field">
            <span>Laji tai alalaji</span>
            <select
              value={sportCode}
              onChange={(event) => setSportCode(event.target.value)}
            >
              {listFullySupportedDisciplines().map((code) => (
                <option key={code} value={code}>
                  {sportLabels[code] ?? code}
                </option>
              ))}
              <option value="other">Muu laji</option>
            </select>
          </label>
          {sportCode === 'other' && (
            <label className="field">
              <span>Lajin nimi</span>
              <input
                required
                value={customSport}
                onChange={(event) => setCustomSport(event.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>Alkaa</span>
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Kesto (min)</span>
              <input
                type="number"
                min="5"
                max="600"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>RPE 0–10</span>
              <input
                type="number"
                min="0"
                max="10"
                value={rpe}
                onChange={(event) => setRpe(Number(event.target.value))}
              />
            </label>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={coachDefined}
              onChange={(event) => setCoachDefined(event.target.checked)}
            />
            <span>Valmentajan määräämä – sovellus ei saa siirtää.</span>
          </label>
          <button className="button button-primary" disabled={pending || !selectedSport}>
            Tallenna lajiharjoitus
          </button>
        </form>
        <form className="surface-card form" onSubmit={saveEvent}>
          <p className="eyebrow">Kilpailukalenteri</p>
          <h2>Lisää tapahtuma</h2>
          <label className="field">
            <span>Tapahtuman nimi</span>
            <input
              required
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Alkaa</span>
            <input
              required
              type="datetime-local"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Prioriteetti</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
            >
              <option value="A">A – kauden päätavoite</option>
              <option value="B">B – tärkeä tapahtuma</option>
              <option value="TRAINING">Harjoitustapahtuma</option>
            </select>
          </label>
          <button className="button button-primary" disabled={pending}>
            Tallenna tapahtuma
          </button>
        </form>
      </section>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <section className="two-column-grid align-start">
        <article className="surface-card">
          <p className="eyebrow">Tulevat lajiharjoitukset</p>
          <ul className="list-reset stack-list">
            {data.list('fixed_sport_sessions').length ? (
              data.list('fixed_sport_sessions').map((record) => {
                const sessionData = objectValue(record.data.session_data)
                const code = stringValue(sessionData.sport_code)
                return (
                  <li key={record.id}>
                    <strong>{sportLabels[code] ?? code}</strong>
                    <span>
                      {fiDate(stringValue(record.data.starts_at))} ·{' '}
                      {String(record.data.duration_minutes ?? '')} min · RPE{' '}
                      {String(record.data.rpe ?? '')}
                    </span>
                  </li>
                )
              })
            ) : (
              <li className="muted-copy">Ei kiinteitä lajiharjoituksia.</li>
            )}
          </ul>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Tapahtumat</p>
          <ul className="list-reset stack-list">
            {data.list('competition_events').length ? (
              data.list('competition_events').map((record) => (
                <li key={record.id}>
                  <span className="pill">{stringValue(record.data.priority)}</span>
                  <strong>{stringValue(record.data.name)}</strong>
                  <span>{fiDate(stringValue(record.data.starts_at))}</span>
                </li>
              ))
            ) : (
              <li className="muted-copy">Ei tulevia tapahtumia.</li>
            )}
          </ul>
        </article>
      </section>
    </div>
  )
}
