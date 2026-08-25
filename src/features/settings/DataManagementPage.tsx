import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { syncableTables, type SyncableTable } from '../../domain/sync/types'
import { useAppData } from '../app-data/appDataContextValue'
import { useAuth } from '../auth/authContextValue'
import {
  buildDataExport,
  downloadTextFile,
  parseDataExport,
  restoreDataExport,
  serializeDataExport,
  tableToCsv,
} from '../privacy/dataPortability'
import { progressPhotoService } from '../progress/progressPhotoService'
import { objectValue, toJsonObject } from '../coaching/coachingData'

const sensitiveKeys = new Set([
  'healthConcern',
  'healthNotes',
  'medicationAffectsHeartRate',
  'pregnancyStatus',
  'doctorRestrictions',
  'currentInjuries',
  'pelvicFloorSymptoms',
  'exertionWarningSymptoms',
  'eatingDisorderHistory',
  'menstrualTrackingOptIn',
  'health_notes',
  'medication_affects_heart_rate',
  'pregnancy_status',
  'doctor_restrictions',
  'current_injuries_surgeries_and_mobility_limits',
  'pelvic_floor_symptoms',
  'exertion_warning_symptoms',
  'eating_disorder_history',
  'menstrual_tracking_opt_in',
  'menstrualCycle',
  'safetySymptoms',
  'newPain',
  'illnessSymptoms',
  'pain',
  'painLocation',
  'stopReason',
])

function withoutSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSensitiveValues)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKeys.has(key))
      .map(([key, item]) => [key, withoutSensitiveValues(item)]),
  )
}

const tableNames: Partial<Record<SyncableTable, string>> = {
  profiles: 'Profiili',
  health_screenings: 'Terveysseulonnat',
  goal_profiles: 'Tavoitteet',
  goal_periods: 'Tavoitejaksot',
  plan_versions: 'Suunnitelmaversiot',
  training_plans: 'Harjoitussuunnitelmat',
  workout_logs: 'Harjoitushistoria',
  nutrition_logs: 'Ravintomerkinnät',
  body_metrics: 'Kehomittaukset',
  daily_checkins: 'Kuntotarkistukset',
  reminders: 'Muistutukset',
  push_subscriptions: 'Push-tilaukset',
}

export function DataManagementPage() {
  const data = useAppData()
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pendingSync = data.records.filter(
    (record) => record.syncState !== 'SYNCED',
  ).length
  const populatedTables = syncableTables.filter((table) => data.list(table).length > 0)

  const exportJson = async () => {
    if (!session) return
    setBusy(true)
    setMessage('')
    let photoListUnavailable = false
    try {
      let photoMetadata: Parameters<typeof buildDataExport>[2] = []
      try {
        const photos = await progressPhotoService.list(session.user.id)
        photoMetadata = photos.map((photo) => ({
          path: photo.path,
          createdAt: photo.createdAt,
          updatedAt: photo.updatedAt,
          size: photo.size,
          mimeType: photo.mimeType,
        }))
      } catch {
        photoListUnavailable = true
      }
      const exported = buildDataExport(data.records, session.user.id, photoMetadata)
      downloadTextFile(
        `haukkari-${new Date().toISOString().slice(0, 10)}.json`,
        serializeDataExport(exported),
        'application/json;charset=utf-8',
      )
      setMessage(
        photoListUnavailable
          ? 'JSON-vienti ladattiin paikallisista tiedoista, mutta kuvaluetteloa ei saatu verkkopalvelusta.'
          : 'JSON-vienti ladattiin.',
      )
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = (table: SyncableTable) => {
    downloadTextFile(
      `haukkari-${table}-${new Date().toISOString().slice(0, 10)}.csv`,
      tableToCsv(data.records, table),
      'text/csv;charset=utf-8',
    )
    setMessage(`${tableNames[table] ?? table}: CSV-vienti ladattiin.`)
  }

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      const exported = parseDataExport(await file.text())
      if (
        !confirm(
          'Palautetaanko viennin puuttuvat tiedot tälle tilille? Olemassa olevia tietueita ei korvata.',
        )
      )
        return
      const result = await restoreDataExport(exported, data)
      setMessage(
        `Palautus valmis: ${result.created} lisätty, ${result.updated} profiili päivitetty ja ${result.skipped} jo olemassa. Laitesidonnaisia push-tilauksia ei palautettu.`,
      )
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Tietoja ei voitu palauttaa.')
    } finally {
      setBusy(false)
    }
  }

  const withdrawHealthConsent = async () => {
    if (
      !confirm(
        'Perutaanko terveystietojen käsittelysuostumus? Terveysseulonnat ja päivittäiset kuntotarkistukset poistetaan. Harjoitushistoria säilyy ilman kipu- ja oiretietoja.',
      )
    )
      return
    setBusy(true)
    setMessage('')
    try {
      for (const record of [
        ...data.list('health_screenings'),
        ...data.list('daily_checkins'),
      ]) {
        await data.remove(record)
      }
      for (const record of data.list('profiles')) {
        await data.update(
          record,
          toJsonObject({
            sensitive_data_consent_at: null,
            app_settings: withoutSensitiveValues(objectValue(record.data.app_settings)),
          }),
        )
      }
      for (const record of data.list('goal_profiles')) {
        await data.update(
          record,
          toJsonObject({
            preferences: withoutSensitiveValues(objectValue(record.data.preferences)),
          }),
        )
      }
      for (const record of data.list('goal_periods')) {
        await data.update(
          record,
          toJsonObject({
            summary: withoutSensitiveValues(objectValue(record.data.summary)),
          }),
        )
      }
      for (const record of data.list('plan_versions')) {
        await data.update(
          record,
          toJsonObject({
            snapshot: withoutSensitiveValues(objectValue(record.data.snapshot)),
          }),
        )
      }
      for (const record of data.list('workout_logs')) {
        await data.update(
          record,
          toJsonObject({
            feedback: withoutSensitiveValues(objectValue(record.data.feedback)),
          }),
        )
      }
      setMessage(
        'Terveystietojen suostumus peruttiin. Terveysseulonnat ja kuntotarkistukset poistettiin, ja harjoituspalautteesta poistettiin oirekentät.',
      )
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : 'Terveystietojen suostumusta ei voitu perua.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <p className="eyebrow">Sinun tietosi</p>
        <h1>Vienti ja poistaminen</h1>
        <p>Näet paikallisen tietomäärän ennen kuin teet tietoja muuttavia valintoja.</p>
      </header>
      <div className="metric-grid">
        <article className="metric-card">
          <span>Tietueita</span>
          <strong>{data.records.length}</strong>
        </article>
        <article className="metric-card">
          <span>Odottaa synkronointia</span>
          <strong>{pendingSync}</strong>
        </article>
        <article className="metric-card">
          <span>Harjoituksia</span>
          <strong>{data.list('workout_logs').length}</strong>
        </article>
      </div>
      <section className="surface-card">
        <h2>Täysi JSON-vienti ja palautus</h2>
        <p>
          JSON sisältää kaikki aktiiviset sovellustietueet ja yksityisten kuvien
          metatiedot. Tiedosto voi sisältää arkaluonteisia tietoja: säilytä se
          turvallisesti. Palautus lisää puuttuvat tietueet eikä palauta laitesidonnaisia
          push-avaimia tai kuvatiedostoja.
        </p>
        <div className="button-row">
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !session}
            onClick={() => void exportJson()}
          >
            {busy ? 'Käsitellään…' : 'Lataa kaikki JSON-muodossa'}
          </button>
          <label className="button button-secondary file-button">
            Palauta JSON-viennistä
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => void restore(event)}
            />
          </label>
          <Link className="button button-secondary" to="/tili">
            Tilin poistaminen
          </Link>
        </div>
        {message && (
          <p className="status-banner" role="status">
            {message}
          </p>
        )}
      </section>
      <section className="surface-card">
        <h2>Terveystietojen suostumus</h2>
        <p>
          Voit perua vapaaehtoisten terveystietojen käsittelysuostumuksen ilman tilin
          poistamista. Tällöin oireisiin perustuva yksilöllinen turvallisuusohjaus ei ole
          käytettävissä ennen uutta suostumusta ja kartoitusta.
        </p>
        <button
          className="button button-secondary"
          type="button"
          disabled={busy || !data.latest('profiles')?.data.sensitive_data_consent_at}
          onClick={() => void withdrawHealthConsent()}
        >
          Peru terveystietojen suostumus
        </button>
      </section>
      <section className="surface-card">
        <h2>CSV-vienti taulukoittain</h2>
        <p className="muted-copy">
          Jokainen tiedostopainike vie yhden tietotaulun UTF-8 CSV-muodossa.
        </p>
        <div className="export-table-list">
          {populatedTables.map((table) => (
            <div className="settings-row" key={table}>
              <span>
                <strong>{tableNames[table] ?? table}</strong>
                <small>{data.list(table).length} tietuetta</small>
              </span>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => exportCsv(table)}
              >
                Lataa CSV
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="surface-card">
        <h2>Yksittäisten tietojen poistaminen</h2>
        <p>
          Kehomittaukset poistetaan mittaushistoriassa ja kuvat yksityisten kuvien
          näkymässä. Poisto merkitään offline-tilassa ja synkronoidaan yhteyden palatessa.
        </p>
        <div className="button-row">
          <Link className="button button-secondary" to="/edistyminen">
            Avaa mittaukset
          </Link>
          <Link className="button button-secondary" to="/kehityskuvat">
            Avaa kehityskuvat
          </Link>
          <Link className="button button-secondary" to="/tietosuoja">
            Lue tietosuojasta
          </Link>
        </div>
      </section>
    </div>
  )
}
