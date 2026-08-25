import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady || needRefresh) return
    const timeout = window.setTimeout(() => setOfflineReady(false), 6_000)
    return () => window.clearTimeout(timeout)
  }, [needRefresh, offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <aside className="update-notice" aria-live="polite">
      <p>
        {needRefresh
          ? 'Haukkarista on saatavilla uusi versio.'
          : 'Haukkari on valmis toimimaan ilman verkkoyhteyttä.'}
      </p>
      <div className="button-row">
        {needRefresh && (
          <button
            className="button button-primary"
            onClick={() => updateServiceWorker(true)}
          >
            Päivitä nyt
          </button>
        )}
        <button
          className="button button-ghost"
          onClick={() => {
            setNeedRefresh(false)
            setOfflineReady(false)
          }}
        >
          Sulje
        </button>
      </div>
    </aside>
  )
}
