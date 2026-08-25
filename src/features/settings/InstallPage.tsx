import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches
}

export function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const finish = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', finish)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', finish)
    }
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <p className="eyebrow">PWA</p>
        <h1>Asenna Haukkari</h1>
        <p>
          Saat sovelluksen aloitusnäyttöön ja aktiivinen harjoitus toimii myös yhteyden
          katketessa.
        </p>
      </header>
      {installed ? (
        <section className="surface-card success-panel" role="status">
          <strong>Sovellus on asennettu.</strong>
          <span>Voit avata sen laitteen sovellusvalikosta.</span>
        </section>
      ) : prompt ? (
        <button
          className="button button-primary button-wide"
          type="button"
          onClick={() => void install()}
        >
          Asenna tälle laitteelle
        </button>
      ) : (
        <p className="status-banner">
          Selain tarjoaa asennuspainikkeen, kun asennus on tuettu. Voit käyttää myös alla
          olevia ohjeita.
        </p>
      )}
      <div className="two-column-grid align-start">
        <section className="surface-card instruction-card">
          <p className="eyebrow">iPhone / iPad · Safari</p>
          <h2>Lisää Koti-valikkoon</h2>
          <ol>
            <li>Avaa tämä sivu Safarissa.</li>
            <li>Paina Jaa-painiketta.</li>
            <li>
              Valitse <strong>Lisää Koti-valikkoon</strong> ja vahvista.
            </li>
          </ol>
        </section>
        <section className="surface-card instruction-card">
          <p className="eyebrow">Android · Chrome</p>
          <h2>Asenna sovellus</h2>
          <ol>
            <li>Avaa Chromen valikko.</li>
            <li>
              Valitse <strong>Asenna sovellus</strong> tai{' '}
              <strong>Lisää aloitusnäyttöön</strong>.
            </li>
            <li>Vahvista asennus.</li>
          </ol>
        </section>
      </div>
    </div>
  )
}
