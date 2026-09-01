import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ThemeToggle } from '../../app/ThemeToggle'
import { useAuth } from '../auth/authContextValue'
import { useAppData } from '../app-data/appDataContextValue'
import { saveEquipmentSettings } from '../coaching/coachingActions'
import { objectValue } from '../coaching/coachingData'

const equipmentPresets = [
  { label: 'Ei välineitä', equipment: ['Kehonpaino'] },
  {
    label: 'Koti',
    equipment: ['Kehonpaino', 'Käsipainot', 'Kahvakuula', 'Vastuskuminauhat'],
  },
  {
    label: 'Kuntosali',
    equipment: [
      'Kehonpaino',
      'Käsipainot',
      'Levytanko ja painot',
      'Kahvakuula',
      'Vastuskuminauhat',
      'Kuntosalilaitteet',
    ],
  },
] as const

export function SettingsPage() {
  const { session } = useAuth()
  const data = useAppData()
  const [equipmentMessage, setEquipmentMessage] = useState('')
  const [savingEquipment, setSavingEquipment] = useState(false)
  const currentEquipment = objectValue(
    data.latest('profiles')?.data.app_settings,
  ).equipment
  return (
    <div className="page-stack">
      <header className="section-heading">
        <p className="eyebrow">Sovellus</p>
        <h1>Asetukset ja tietosuoja</h1>
        <p>Ulkoasu, tili ja omien tietojen hallinta.</p>
      </header>
      <section className="surface-card settings-row">
        <div>
          <strong>Väriteema</strong>
          <p className="muted-copy">
            Käytä laitteen teemaa tai vaihda vaaleaan tai tummaan.
          </p>
        </div>
        <ThemeToggle />
      </section>
      <section className="surface-card" id="harjoitusvalineet">
        <p className="eyebrow">Harjoitteluprofiili</p>
        <h2>Harjoitusvälineet</h2>
        <p className="muted-copy">
          Valitse ympäristö, jota seuraavissa muodostettavissa harjoituksissa voidaan
          oikeasti käyttää. Pelkkä kehonpaino ei tällä hetkellä riitä tuettuun
          voimaviikkoon, koska vetävä liikesuunta tarvitsee välineen.
        </p>
        <p>
          Nykyinen valinta:{' '}
          <strong>
            {Array.isArray(currentEquipment)
              ? currentEquipment.filter((item) => typeof item === 'string').join(', ')
              : 'ei vahvistettua valintaa'}
          </strong>
        </p>
        <div className="button-row">
          {equipmentPresets.map((preset) => (
            <button
              className="button button-secondary"
              disabled={savingEquipment}
              key={preset.label}
              onClick={() => {
                setSavingEquipment(true)
                setEquipmentMessage('')
                void saveEquipmentSettings(data, [...preset.equipment])
                  .then(() =>
                    setEquipmentMessage(
                      'Välineet tallennettiin. Uusi viikkoversio käyttää päivitettyä valintaa.',
                    ),
                  )
                  .catch((reason: unknown) =>
                    setEquipmentMessage(
                      reason instanceof Error
                        ? reason.message
                        : 'Välineitä ei voitu tallentaa.',
                    ),
                  )
                  .finally(() => setSavingEquipment(false))
              }}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
        {equipmentMessage && <p role="status">{equipmentMessage}</p>}
      </section>
      <section className="surface-card">
        <p className="eyebrow">Kirjautunut käyttäjä</p>
        <h2>{session?.user.email ?? 'Haukkarin käyttäjä'}</h2>
        <div className="button-row">
          <Link className="button button-secondary" to="/tili">
            Tilin suojaus
          </Link>
          <Link className="button button-secondary" to="/synkronointi">
            Synkronointi
          </Link>
        </div>
      </section>
      <div className="link-card-grid">
        <Link className="link-card" to="/asenna">
          <strong>Asenna sovellus</strong>
          <span>PWA-ohjeet iPhonelle ja Androidille</span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link className="link-card" to="/tiedot">
          <strong>Omat tiedot</strong>
          <span>Yhteenveto, vienti ja poistamisen hallinta</span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link className="link-card" to="/tietosuoja">
          <strong>Tietosuojaseloste</strong>
          <span>Mitä tietoja käsitellään ja miksi</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
