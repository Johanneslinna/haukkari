import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue'
import { SyncStatusCard } from '../sync/SyncStatusCard'
import { HaukkariLogo } from '../../app/HaukkariLogo'

export function HomePage() {
  const { session } = useAuth()
  const today = new Intl.DateTimeFormat('fi-FI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <main className="content-page">
      <header className="page-header">
        <div className="brand">
          <HaukkariLogo />
        </div>
        <Link className="button button-ghost" to="/tili">
          Oma tili
        </Link>
      </header>
      <section className="hero-card">
        <p className="eyebrow">{today}</p>
        <h1>Tervetuloa Haukkariin</h1>
        <p>
          Käyttäjätili on valmis. Aloituskartoitus, päivän harjoitus ja
          offline-synkronointi rakennetaan seuraavissa hyväksyntävaiheissa.
        </p>
        <div className="status-row" role="status">
          <span className="status-dot" aria-hidden="true" />
          Kirjautuneena: {session?.user.email}
        </div>
      </section>
      <SyncStatusCard />
      <section className="phase-grid" aria-label="Toteutuksen tila">
        <article className="phase-card complete">
          <span>01</span>
          <h2>Turvallinen tili</h2>
          <p>Sähköposti, salasana, palautus ja käyttäjäeristys.</p>
        </article>
        <article className="phase-card complete">
          <span>02</span>
          <h2>Offline-synkronointi</h2>
          <p>Paikallinen tallennus, outbox, versiot ja ristiriidat.</p>
        </article>
        <article className="phase-card">
          <span>03</span>
          <h2>Valmennuslogiikka</h2>
          <p>Deterministiset ja perustellut päätökset.</p>
        </article>
      </section>
    </main>
  )
}
