import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../authContextValue'
import { authErrorMessage } from '../formUtils'
import {
  clearLocalAccountData,
  resetTrainingProfileData,
} from '../../privacy/localPrivacy'
import { HaukkariLogo } from '../../../app/HaukkariLogo'
import { useAppData } from '../../app-data/appDataContextValue'

export function AccountPage() {
  const { api, session } = useAuth()
  const data = useAppData()
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState('')
  const [profileResetConfirmation, setProfileResetConfirmation] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<'signout' | 'profile-reset' | 'delete' | null>(
    null,
  )

  const signOut = async () => {
    setError('')
    setPending('signout')
    try {
      await api.signOut()
      if (session) await clearLocalAccountData(session.user.id)
      navigate('/kirjaudu', { replace: true })
    } catch (reason) {
      setError(authErrorMessage(reason))
    } finally {
      setPending(null)
    }
  }

  const resetTrainingProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (profileResetConfirmation !== 'ALOITA ALUSTA') {
      setError('Kirjoita ALOITA ALUSTA täsmälleen pyydetyssä muodossa.')
      return
    }
    setError('')
    setPending('profile-reset')
    try {
      // Poistot kirjoitetaan normaaliin offline-outboxiin. Näin ne poistavat myös
      // palvelimelle aiemmin synkronoidun datan eivätkä vain selaimen kopiota.
      await resetTrainingProfileData(data)
      setProfileResetConfirmation('')
      navigate('/aloitus', { replace: true })
    } catch (reason) {
      setError(authErrorMessage(reason))
    } finally {
      setPending(null)
    }
  }

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (confirmation !== 'POISTA') {
      setError('Kirjoita POISTA täsmälleen pyydetyssä muodossa.')
      return
    }
    setError('')
    setPending('delete')
    try {
      await api.deleteAccount()
      if (session) await clearLocalAccountData(session.user.id)
      await api.signOut().catch(() => undefined)
      navigate('/kirjaudu', { replace: true })
    } catch (reason) {
      setError(authErrorMessage(reason))
    } finally {
      setPending(null)
    }
  }

  return (
    <main className="content-page">
      <header className="page-header">
        <Link className="brand" to="/">
          <HaukkariLogo />
        </Link>
        <Link to="/">Takaisin</Link>
      </header>
      <section className="content-card">
        <p className="eyebrow">Asetukset ja tietosuoja</p>
        <h1>Oma tili</h1>
        <dl className="account-details">
          <div>
            <dt>Sähköposti</dt>
            <dd>{session?.user.email ?? 'Ei saatavilla'}</dd>
          </div>
          <div>
            <dt>Istunto</dt>
            <dd>Suojattu Supabase Auth -istunto</dd>
          </div>
        </dl>
        <button
          className="button button-secondary"
          onClick={signOut}
          disabled={pending !== null}
        >
          {pending === 'signout'
            ? 'Kirjaudutaan ulos…'
            : 'Kirjaudu ulos ja vaihda käyttäjää'}
        </button>
      </section>

      <section className="content-card danger-card">
        <h2>Poista harjoitteluprofiilini ja aloita alusta</h2>
        <p>
          Tämä poistaa tavoitteet, suunnitelmat, harjoitushistorian, terveystiedot,
          mittaukset ja muistutukset. Käyttäjätili ja sähköpostiosoite säilyvät. Poistot
          synkronoidaan palvelimelle, kun yhteys on käytettävissä.
        </p>
        <form className="form" onSubmit={resetTrainingProfile}>
          <label className="field">
            <span>Vahvista kirjoittamalla ALOITA ALUSTA</span>
            <input
              value={profileResetConfirmation}
              onChange={(event) => setProfileResetConfirmation(event.target.value)}
            />
          </label>
          <button className="button button-danger" disabled={pending !== null}>
            {pending === 'profile-reset'
              ? 'Poistetaan harjoitteluprofiilia…'
              : 'Poista harjoitteluprofiili ja aloita alusta'}
          </button>
        </form>
      </section>

      <section className="content-card danger-card">
        <h2>Poista tili ja kaikki tiedot</h2>
        <p>
          Toimintoa ei voi perua. Tietokantarivit, yksityiset kuvat, push-tilaukset ja
          käyttäjätunnus poistetaan.
        </p>
        <form className="form" onSubmit={deleteAccount}>
          <label className="field">
            <span>Vahvista kirjoittamalla POISTA</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-danger" disabled={pending !== null}>
            {pending === 'delete' ? 'Poistetaan…' : 'Poista tilini pysyvästi'}
          </button>
        </form>
      </section>
    </main>
  )
}
