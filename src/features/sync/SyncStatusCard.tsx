import { Link } from 'react-router-dom'
import type { SyncState } from '../../domain/sync/types'
import { useSync } from './syncContextValue'

const labels: Record<SyncState, string> = {
  SYNCED: 'Synkronoitu',
  SYNCING: 'Synkronointi kesken',
  OFFLINE: 'Offline',
  ERROR: 'Synkronointivirhe',
  CONFLICT: 'Ristiriita vaatii valinnan',
}

export function SyncStatusCard() {
  const { status, syncNow } = useSync()
  const lastSynced = status.lastSyncedAt
    ? new Intl.DateTimeFormat('fi-FI', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(status.lastSyncedAt))
    : 'Ei vielä synkronoitu'

  return (
    <section className="content-card sync-card" aria-labelledby="sync-heading">
      <div>
        <p className="eyebrow">Pilvitallennus</p>
        <h2 id="sync-heading">{labels[status.state]}</h2>
        <p>Viimeisin onnistunut synkronointi: {lastSynced}</p>
        {status.pendingCount > 0 && <p>Jonossa: {status.pendingCount} muutosta</p>}
        {status.errorMessage && <p className="form-error">{status.errorMessage}</p>}
      </div>
      <div className="sync-actions">
        {status.conflictCount > 0 && (
          <Link className="button button-secondary" to="/synkronointi">
            Ratkaise ristiriidat ({status.conflictCount})
          </Link>
        )}
        <button
          className="button button-secondary"
          type="button"
          disabled={status.state === 'SYNCING'}
          onClick={() => void syncNow()}
        >
          Synkronoi nyt
        </button>
      </div>
    </section>
  )
}
