import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../app/ThemeToggle'
import { useAuth } from '../auth/authContextValue'

export function SettingsPage() {
  const { session } = useAuth()
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
