import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../app-data/appDataContextValue'
import { addBodyMetric, evaluateWeightProgress } from '../coaching/coachingActions'
import {
  arrayValue,
  fiDate,
  numberValue,
  objectValue,
  stringValue,
  toJsonObject,
} from '../coaching/coachingData'

type TrendPoint = { label: string; value: number }

const metricDescriptions: Record<string, string> = {
  'Harjoitusten toteuma': 'Kertyneet loppuun tai osittain tehdyt harjoitukset.',
  Voimatasot: 'Suurin kirjattu kilogrammakuorma harjoitusta kohti.',
  Kestävyyskunto: 'Kirjattujen kestävyysharjoitusten kesto.',
  Paino: 'Omat painomittauksesi aikajärjestyksessä.',
  Vyötärönympärys: 'Omat vyötärömittauksesi aikajärjestyksessä.',
  'Koettu energia ja palautuminen': 'Päivän kuntotarkistuksessa ilmoitettu energia.',
  'Liikkuvuus ja toimintakyky':
    'Vertailukelpoinen testi lisätään, kun ensimmäinen toimintakykymittaus on kirjattu.',
  'Nopeus ja räjähtävä voima':
    'Vertailukelpoinen nopeus- tai hyppytesti lisätään, kun ensimmäinen testi on kirjattu.',
}

const progressLabels = {
  INSUFFICIENT_DATA: 'Kerätään vielä vertailukelpoista dataa',
  IMPROVING: 'Suunta tukee tavoitetta',
  PLATEAU: 'Mahdollinen tasanne',
  DECLINING: 'Suunta vaatii arviointia',
}

export function ProgressPage() {
  const data = useAppData()
  const [weightKg, setWeightKg] = useState<number | undefined>()
  const [waistCm, setWaistCm] = useState<number | undefined>()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const weightProgress = evaluateWeightProgress(data)
  const metrics = [...data.list('body_metrics')].sort((left, right) =>
    stringValue(left.data.measured_on, left.createdAt).localeCompare(
      stringValue(right.data.measured_on, right.createdAt),
    ),
  )
  const workoutLogs = data
    .list('workout_logs')
    .filter((record) => record.data.completion_status !== 'IN_PROGRESS')
  const lastMetric = [...metrics]
    .reverse()
    .find((record) => typeof record.data.weight_kg === 'number')
  const profileSettings = objectValue(data.latest('profiles')?.data.app_settings)
  const desiredMetrics = arrayValue(profileSettings.desiredMetrics).filter(
    (value): value is string => typeof value === 'string',
  )
  const selectedMetrics = desiredMetrics.length
    ? desiredMetrics
    : ['Harjoitusten toteuma', 'Koettu energia ja palautuminen']
  const averageRpe = workoutLogs.length
    ? workoutLogs.reduce((sum, record) => sum + numberValue(record.data.rpe), 0) /
      workoutLogs.length
    : null
  const chronologicalLogs = [...workoutLogs].sort((left, right) =>
    stringValue(left.data.performed_at, left.createdAt).localeCompare(
      stringValue(right.data.performed_at, right.createdAt),
    ),
  )
  const workoutsById = new Map(data.list('workouts').map((record) => [record.id, record]))
  const weightPoints = metricPoints(metrics, 'weight_kg')
  const waistPoints = metricPoints(metrics, 'waist_cm')
  const adherencePoints = chronologicalLogs.map((record, index) => ({
    label: shortDate(stringValue(record.data.performed_at, record.createdAt)),
    value: index + 1,
  }))
  const strengthPoints = chronologicalLogs.flatMap((record) => {
    const values = arrayValue(objectValue(record.data.feedback).exerciseResults)
      .flatMap((result) => arrayValue(objectValue(result).loads))
      .map((value) => (typeof value === 'string' ? Number(value) : Number.NaN))
      .filter(Number.isFinite)
    return values.length
      ? [
          {
            label: shortDate(stringValue(record.data.performed_at, record.createdAt)),
            value: Math.max(...values),
          },
        ]
      : []
  })
  const endurancePoints = chronologicalLogs.flatMap((record) => {
    const workout = workoutsById.get(stringValue(record.data.workout_id))
    const kind = stringValue(objectValue(workout?.data.prescription).kind)
    return kind === 'EASY_ENDURANCE' || kind === 'INTERVAL'
      ? [
          {
            label: shortDate(stringValue(record.data.performed_at, record.createdAt)),
            value: numberValue(record.data.duration_minutes),
          },
        ]
      : []
  })
  const energyPoints = [...data.list('daily_checkins')]
    .sort((left, right) =>
      stringValue(left.data.checkin_date, left.createdAt).localeCompare(
        stringValue(right.data.checkin_date, right.createdAt),
      ),
    )
    .flatMap((record) => {
      const energy = stringValue(objectValue(record.data.answers).energy)
      const value =
        energy === 'LOW' ? 1 : energy === 'NORMAL' ? 2 : energy === 'HIGH' ? 3 : 0
      return value
        ? [{ label: shortDate(stringValue(record.data.checkin_date)), value }]
        : []
    })
  const trends: Record<string, { points: TrendPoint[]; unit: string; empty: string }> = {
    'Harjoitusten toteuma': {
      points: adherencePoints,
      unit: ' harjoitusta',
      empty: 'Ensimmäinen tallennettu harjoitus aloittaa graafin.',
    },
    Voimatasot: {
      points: strengthPoints,
      unit: ' kg',
      empty: 'Kirjaa voimaliikkeen kuorma, jotta vertailukelpoinen trendi alkaa.',
    },
    Kestävyyskunto: {
      points: endurancePoints,
      unit: ' min',
      empty: 'Tee ja tallenna kestävyysharjoitus, jotta kestotrendi alkaa.',
    },
    Paino: {
      points: weightPoints,
      unit: ' kg',
      empty: 'Kirjaa vähintään yksi painomittaus.',
    },
    Vyötärönympärys: {
      points: waistPoints,
      unit: ' cm',
      empty: 'Kirjaa vähintään yksi vyötärömittaus.',
    },
    'Koettu energia ja palautuminen': {
      points: energyPoints,
      unit: '/3',
      empty: 'Päivän kuntotarkistus aloittaa energiatrendin.',
    },
    'Liikkuvuus ja toimintakyky': {
      points: [],
      unit: '',
      empty: metricDescriptions['Liikkuvuus ja toimintakyky']!,
    },
    'Nopeus ja räjähtävä voima': {
      points: [],
      unit: '',
      empty: metricDescriptions['Nopeus ja räjähtävä voima']!,
    },
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setMessage('')
    try {
      await addBodyMetric(data, { weightKg, waistCm })
      setMessage('Mittaus tallennettiin. Yksittäinen lukema ei muuta suosituksia.')
      setWeightKg(undefined)
      setWaistCm(undefined)
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : 'Mittausta ei voitu tallentaa.',
      )
    } finally {
      setPending(false)
    }
  }

  const toggleMetric = async (metric: string) => {
    const profile = data.latest('profiles')
    if (!profile) return
    const next = selectedMetrics.includes(metric)
      ? selectedMetrics.filter((item) => item !== metric)
      : [...selectedMetrics, metric]
    if (!next.length) {
      setMessage('Valitse vähintään yksi kehitysmittari.')
      return
    }
    setPending(true)
    setMessage('')
    try {
      await data.update(
        profile,
        toJsonObject({
          app_settings: { ...profileSettings, desiredMetrics: next },
        }),
      )
      setMessage('Seurattavat mittarit päivitettiin.')
    } finally {
      setPending(false)
    }
  }

  const removeMetric = async (record: (typeof metrics)[number]) => {
    if (!confirm('Poistetaanko tämä mittaus pysyvästi?')) return
    setPending(true)
    setMessage('')
    try {
      await data.remove(record)
      setMessage('Mittaus poistettiin.')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Mittausta ei voitu poistaa.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Tavoitekohtainen seuranta</p>
          <h1>Edistyminen</h1>
          <p>Tasanne vaatii kaksi vertailukelpoista arviojaksoa ja riittävästi dataa.</p>
        </div>
      </header>
      <section className="metric-grid">
        <article className="surface-card metric-card">
          <span>Harjoituksia</span>
          <strong>{workoutLogs.length}</strong>
          <p>yhteensä tallennettuna</p>
        </article>
        <article className="surface-card metric-card">
          <span>Viimeisin paino</span>
          <strong>
            {lastMetric && typeof lastMetric.data.weight_kg === 'number'
              ? `${lastMetric.data.weight_kg.toLocaleString('fi-FI')} kg`
              : '—'}
          </strong>
          <p>
            {lastMetric
              ? fiDate(stringValue(lastMetric.data.measured_on))
              : 'ei mittauksia'}
          </p>
        </article>
        <article className="surface-card metric-card">
          <span>Keskimääräinen RPE</span>
          <strong>
            {averageRpe === null
              ? '—'
              : averageRpe.toLocaleString('fi-FI', { maximumFractionDigits: 1 })}
          </strong>
          <p>toteutuneista harjoituksista</p>
        </article>
      </section>
      <section className="surface-card progress-trends">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Valitsemasi mittarit</p>
            <h2>Kehitystrendit</h2>
            <p>Graafit käyttävät vain keskenään saman tyyppisiä kirjauksia.</p>
          </div>
        </div>
        <div className="trend-grid">
          {selectedMetrics.map((metric) => {
            const trend = trends[metric] ?? { points: [], unit: '', empty: 'Ei dataa.' }
            return (
              <article className="trend-card" key={metric}>
                <h3>{metric}</h3>
                <p className="muted-copy">{metricDescriptions[metric]}</p>
                <TrendChart points={trend.points} unit={trend.unit} empty={trend.empty} />
              </article>
            )
          })}
        </div>
        <details className="metric-preferences">
          <summary>Muokkaa seurattavia mittareita</summary>
          <div className="choice-grid">
            {Object.keys(metricDescriptions).map((metric) => (
              <label className="choice-card" key={metric}>
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(metric)}
                  disabled={pending}
                  onChange={() => void toggleMetric(metric)}
                />
                {metric}
              </label>
            ))}
          </div>
        </details>
      </section>
      <section className="two-column-grid align-start">
        <article className="surface-card">
          <p className="eyebrow">Painotrendin arvio</p>
          <h2>{progressLabels[weightProgress.decision.status]}</h2>
          <p>{weightProgress.reasons[0]?.message}</p>
          <p className="muted-copy">
            Paino on yksi mittari muiden joukossa eikä yksittäinen arvo muuta
            ravinto-ohjausta.
          </p>
        </article>
        <form className="surface-card form" onSubmit={submit}>
          <p className="eyebrow">Uusi mittaus</p>
          <h2>Kirjaa kehitysmittari</h2>
          <div className="form-grid">
            <label className="field">
              <span>Paino (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="20"
                max="400"
                value={weightKg ?? ''}
                onChange={(event) =>
                  setWeightKg(event.target.value ? Number(event.target.value) : undefined)
                }
              />
            </label>
            <label className="field">
              <span>Vyötärö (cm)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="30"
                max="250"
                value={waistCm ?? ''}
                onChange={(event) =>
                  setWaistCm(event.target.value ? Number(event.target.value) : undefined)
                }
              />
            </label>
          </div>
          <button
            className="button button-primary"
            disabled={pending || (weightKg === undefined && waistCm === undefined)}
          >
            Tallenna mittaus
          </button>
          <Link className="button button-secondary" to="/muistutukset?malli=mittaus">
            Aseta mittausmuistutus
          </Link>
          {message && (
            <p className="success-message" role="status">
              {message}
            </p>
          )}
        </form>
      </section>
      <section className="surface-card">
        <p className="eyebrow">Mittaushistoria</p>
        <ul className="list-reset stack-list">
          {metrics.length ? (
            [...metrics].reverse().map((record) => (
              <li key={record.id}>
                <strong>{fiDate(stringValue(record.data.measured_on))}</strong>
                <span>
                  {typeof record.data.weight_kg === 'number'
                    ? `${record.data.weight_kg.toLocaleString('fi-FI')} kg`
                    : ''}
                  {typeof record.data.waist_cm === 'number'
                    ? ` · vyötärö ${record.data.waist_cm.toLocaleString('fi-FI')} cm`
                    : ''}
                </span>
                <button
                  className="text-button"
                  type="button"
                  disabled={pending}
                  onClick={() => void removeMetric(record)}
                >
                  Poista
                </button>
              </li>
            ))
          ) : (
            <li className="muted-copy">Ei mittauksia.</li>
          )}
        </ul>
      </section>
    </div>
  )
}

function metricPoints(
  records: ReturnType<typeof useAppData>['records'],
  field: 'weight_kg' | 'waist_cm',
): TrendPoint[] {
  return records.flatMap((record) =>
    typeof record.data[field] === 'number'
      ? [
          {
            label: shortDate(stringValue(record.data.measured_on, record.createdAt)),
            value: record.data[field],
          },
        ]
      : [],
  )
}

function shortDate(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'numeric' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  )
}

function TrendChart({
  points,
  unit,
  empty,
}: {
  points: TrendPoint[]
  unit: string
  empty: string
}) {
  if (!points.length) return <p className="trend-empty">{empty}</p>
  const values = points.map((point) => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = Math.max(maximum - minimum, Math.abs(maximum || 1) * 0.08, 1)
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 50 : 8 + (index / (points.length - 1)) * 84,
    y: 86 - ((point.value - minimum) / range) * 68,
  }))
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const latest = points.at(-1)!
  return (
    <div className="trend-chart">
      <div className="trend-latest">
        <strong>
          {latest.value.toLocaleString('fi-FI')}
          {unit}
        </strong>
        <span>{latest.label}</span>
      </div>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${latest.value}${unit}, ${latest.label}`}
      >
        <line x1="8" y1="86" x2="92" y2="86" />
        {points.length > 1 && <polyline points={polyline} />}
        {coordinates.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="2.8">
            <title>
              {point.label}: {point.value.toLocaleString('fi-FI')}
              {unit}
            </title>
          </circle>
        ))}
      </svg>
      <div className="trend-axis" aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{latest.label}</span>
      </div>
    </div>
  )
}
