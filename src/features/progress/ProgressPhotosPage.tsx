import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/authContextValue'
import { useAppData } from '../app-data/appDataContextValue'
import { objectValue, stringValue, toJsonObject } from '../coaching/coachingData'
import { progressPhotoService, type ProgressPhoto } from './progressPhotoService'

export function ProgressPhotosPage() {
  const { session } = useAuth()
  const data = useAppData()
  const profile = data.latest('profiles')
  const appSettings = objectValue(profile?.data.app_settings)
  const [consent, setConsent] = useState(
    typeof appSettings.progress_photo_consent_at === 'string',
  )
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      setPhotos(await progressPhotoService.list(session.user.id))
      setMessage('')
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : 'Yksityisiä kuvia ei voitu hakea.',
      )
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The storage request owns the loading lifecycle.
    void load()
  }, [load])

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !session || !profile || !consent) return
    setPending(true)
    setMessage('')
    try {
      if (typeof appSettings.progress_photo_consent_at !== 'string') {
        await data.update(
          profile,
          toJsonObject({
            app_settings: {
              ...appSettings,
              progress_photo_consent_at: new Date().toISOString(),
            },
          }),
        )
      }
      await progressPhotoService.upload(session.user.id, file)
      await load()
      setMessage('Kuva tallennettiin yksityiseen kansioosi.')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Kuvaa ei voitu tallentaa.')
    } finally {
      setPending(false)
    }
  }

  const remove = async (photo: ProgressPhoto) => {
    if (!session || !confirm('Poistetaanko tämä kehityskuva pysyvästi?')) return
    setPending(true)
    setMessage('')
    try {
      await progressPhotoService.remove(session.user.id, photo.path)
      setPhotos((current) => current.filter((item) => item.path !== photo.path))
      setMessage('Kuva poistettiin pysyvästi.')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Kuvaa ei voitu poistaa.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Vapaaehtoinen seuranta</p>
          <h1>Yksityiset kehityskuvat</h1>
          <p>
            Kuvat tallennetaan käyttäjätunnukseesi sidottuun yksityiseen kansioon.
            Esikatselulinkki vanhenee viidessä minuutissa.
          </p>
        </div>
      </header>
      <section className="surface-card form-stack">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            Valitsen vapaaehtoisesti kehityskuvien tallennuksen. Ymmärrän, että kuvat
            voivat olla arkaluonteisia ja voin poistaa ne yksittäin milloin tahansa.
          </span>
        </label>
        <label
          className={`button button-primary file-button${!consent ? ' disabled' : ''}`}
        >
          {pending ? 'Käsitellään kuvaa…' : 'Valitse ja lataa kuva'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!consent || pending || !navigator.onLine}
            onChange={(event) => void upload(event)}
          />
        </label>
        {!navigator.onLine && (
          <p className="status-banner">Kuvan lataaminen vaatii verkkoyhteyden.</p>
        )}
        {message && (
          <p role="status" className="status-banner">
            {message}
          </p>
        )}
      </section>
      <section className="surface-card">
        <h2>Omat kuvat</h2>
        {loading ? (
          <p className="muted-copy">Haetaan yksityisiä kuvia…</p>
        ) : photos.length ? (
          <ul className="photo-grid list-reset">
            {photos.map((photo) => (
              <li key={photo.path} className="photo-card">
                {photo.signedUrl ? (
                  <img src={photo.signedUrl} alt="Yksityinen kehityskuva" />
                ) : (
                  <div className="empty-state">Esikatselu ei ole saatavilla.</div>
                )}
                <div>
                  <span>{formatPhotoDate(photo.createdAt)}</span>
                  <button
                    className="text-button"
                    type="button"
                    disabled={pending}
                    onClick={() => void remove(photo)}
                  >
                    Poista pysyvästi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-copy">Et ole tallentanut kehityskuvia.</p>
        )}
      </section>
    </div>
  )
}

function formatPhotoDate(value: string | null) {
  if (!value) return 'Tallennusaika ei saatavilla'
  return new Intl.DateTimeFormat('fi-FI', { dateStyle: 'medium' }).format(
    new Date(stringValue(value)),
  )
}
