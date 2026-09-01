import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppData } from '../app-data/appDataContextValue'
import {
  booleanValue,
  numberArray,
  stringValue,
  toJsonObject,
} from '../coaching/coachingData'
import { downloadReminderIcs } from './reminderCalendar'
import {
  requestWebPushSubscription,
  unsubscribeCurrentDevice,
  webPushFeatureEnabled,
} from './webPush'

const weekdays = [
  { value: 1, label: 'ma' },
  { value: 2, label: 'ti' },
  { value: 3, label: 'ke' },
  { value: 4, label: 'to' },
  { value: 5, label: 'pe' },
  { value: 6, label: 'la' },
  { value: 7, label: 'su' },
]

export function RemindersPage() {
  const data = useAppData()
  const [searchParams] = useSearchParams()
  const measurementPreset = searchParams.get('malli') === 'mittaus'
  const [title, setTitle] = useState(
    measurementPreset ? 'Painon tai ympärysmitan kirjaus' : 'Päivän treenitarkistus',
  )
  const [time, setTime] = useState(measurementPreset ? '09:00' : '17:00')
  const [selectedDays, setSelectedDays] = useState(
    measurementPreset ? [7] : [1, 2, 3, 4, 5, 6, 7],
  )
  const [intervalWeeks, setIntervalWeeks] = useState(measurementPreset ? 4 : 1)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Helsinki'
  const pushRecords = data.list('push_subscriptions')
  const pushActive = pushRecords.some(
    (record) =>
      record.data.device_key === data.deviceId &&
      (!record.data.expires_at ||
        new Date(stringValue(record.data.expires_at)) > new Date()),
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (intervalWeeks !== 0 && !selectedDays.length) {
      setMessage('Valitse vähintään yksi viikonpäivä.')
      return
    }
    setPending(true)
    setMessage('')
    try {
      await data.create(
        'reminders',
        toJsonObject({
          title,
          channel: 'IN_APP',
          local_time: time,
          timezone,
          weekdays: selectedDays,
          interval_weeks: intervalWeeks === 0 ? 4 : intervalWeeks,
          anchor_date: new Date().toISOString().slice(0, 10),
          enabled: intervalWeeks !== 0,
        }),
      )
      setMessage('Muistutus tallennettiin.')
    } finally {
      setPending(false)
    }
  }

  const toggleDay = (day: number) => {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    )
  }

  const enablePush = async () => {
    if (!data.deviceId) return
    setPending(true)
    setMessage('')
    try {
      const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
      if (!publicKey)
        throw new Error('Push-palvelun julkista VAPID-avainta ei ole määritetty.')
      for (const record of pushRecords) {
        const expiresAt = stringValue(record.data.expires_at)
        if (expiresAt && new Date(expiresAt) <= new Date()) await data.remove(record)
      }
      const result = await requestWebPushSubscription(publicKey)
      if (result.status === 'DENIED') {
        setMessage(
          'Et sallinut ilmoituksia. Sovellus ja sisäiset muistutukset toimivat normaalisti.',
        )
        return
      }
      if (result.status === 'UNSUPPORTED') {
        setMessage('Tämä selain tai asennustapa ei tue Web Push -ilmoituksia.')
        return
      }
      const subscriptionData = toJsonObject({
        device_key: data.deviceId,
        endpoint: result.subscription.endpoint,
        p256dh: result.subscription.p256dh,
        auth_key: result.subscription.authKey,
        expires_at: result.subscription.expiresAt,
      })
      const existing = pushRecords.find(
        (record) => record.data.endpoint === result.subscription.endpoint,
      )
      if (existing) await data.update(existing, subscriptionData)
      else await data.create('push_subscriptions', subscriptionData)
      setMessage('Web Push otettiin käyttöön tällä laitteella.')
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : 'Web Pushia ei voitu ottaa käyttöön.',
      )
    } finally {
      setPending(false)
    }
  }

  const disablePush = async () => {
    setPending(true)
    setMessage('')
    try {
      await unsubscribeCurrentDevice()
      for (const record of pushRecords.filter(
        (item) => item.data.device_key === data.deviceId,
      )) {
        await data.remove(record)
      }
      setMessage('Web Push poistettiin käytöstä tältä laitteelta.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <p className="eyebrow">Arjen tuki</p>
        <h1>Muistutukset</h1>
        <p>Ajat tallentuvat aikavyöhykkeesi mukaan myös offline-tilassa.</p>
      </header>
      <div className="two-column-grid align-start">
        <form
          className="surface-card form-stack"
          onSubmit={(event) => void submit(event)}
        >
          <h2>Uusi muistutus</h2>
          <label className="field">
            <span>Otsikko</span>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Aika</span>
            <input
              required
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <fieldset className="weekday-picker">
            <legend>Viikonpäivät</legend>
            <div className="button-row">
              {weekdays.map((day) => (
                <label key={day.value} className="weekday-choice">
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(day.value)}
                    onChange={() => toggleDay(day.value)}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>Toistoväli</span>
            <select
              value={intervalWeeks}
              onChange={(event) => setIntervalWeeks(Number(event.target.value))}
            >
              <option value={0}>Pois käytöstä</option>
              <option value={1}>Joka viikko</option>
              <option value={2}>Joka toinen viikko</option>
              <option value={4}>Kuukausittain</option>
            </select>
          </label>
          <p className="muted-copy">Aikavyöhyke: {timezone}</p>
          <button className="button button-primary" disabled={pending || !data.deviceId}>
            {pending ? 'Tallennetaan…' : 'Tallenna muistutus'}
          </button>
        </form>
        <section className="surface-card">
          <h2>Tallennetut</h2>
          <ul className="list-reset stack-list">
            {data.list('reminders').length ? (
              data.list('reminders').map((record) => {
                const recordDays = numberArray(record.data.weekdays)
                const enabled = booleanValue(record.data.enabled, true)
                const interval = Math.max(1, Number(record.data.interval_weeks) || 1)
                return (
                  <li key={record.id}>
                    <strong>{stringValue(record.data.title)}</strong>
                    <span>
                      {!enabled && 'Pois käytöstä · '}
                      {stringValue(record.data.local_time).slice(0, 5)} ·{' '}
                      {weekdays
                        .filter((day) => recordDays.includes(day.value))
                        .map((day) => day.label)
                        .join(' ')}
                      {interval === 2
                        ? ' · joka toinen viikko'
                        : interval === 4
                          ? ' · kuukausittain'
                          : ''}
                    </span>
                    <div className="button-row">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() =>
                          void data.update(record, toJsonObject({ enabled: !enabled }))
                        }
                      >
                        {enabled ? 'Poista käytöstä' : 'Ota käyttöön'}
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => downloadReminderIcs(record)}
                      >
                        Lataa .ics
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => void data.remove(record)}
                      >
                        Poista
                      </button>
                    </div>
                  </li>
                )
              })
            ) : (
              <li className="muted-copy">Ei muistutuksia.</li>
            )}
          </ul>
        </section>
      </div>
      {webPushFeatureEnabled && (
        <section className="surface-card">
          <p className="eyebrow">Valinnainen kokeilu</p>
          <h2>Web Push tällä laitteella</h2>
          <p>
            Lupa kysytään vasta alla olevasta painikkeesta. Näkyvä ilmoitus on aina
            yleinen: ”Päivän treenitarkistus odottaa.” iPhonessa sivu pitää ensin lisätä
            Koti-valikkoon ja avata asennettuna PWA-sovelluksena.
          </p>
          <button
            className="button button-secondary"
            type="button"
            disabled={pending}
            onClick={() => void (pushActive ? disablePush() : enablePush())}
          >
            {pushActive
              ? 'Poista Web Push tältä laitteelta'
              : 'Salli Web Push tällä laitteella'}
          </button>
        </section>
      )}
      {message && (
        <p className="status-banner" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
