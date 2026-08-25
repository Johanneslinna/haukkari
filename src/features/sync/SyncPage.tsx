import { useState } from 'react'
import { z } from 'zod'
import type { JsonObject, LocalSyncConflict } from '../../domain/sync/types'
import { useSync } from './syncContextValue'
import { SyncStatusCard } from './SyncStatusCard'

const mergedRecordSchema = z.record(z.string(), z.json())

function ConflictCard({ conflict }: { conflict: LocalSyncConflict }) {
  const { resolveConflict } = useSync()
  const [merged, setMerged] = useState(() =>
    JSON.stringify({ ...conflict.remoteSnapshot, ...conflict.localSnapshot }, null, 2),
  )
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const resolve = async (choice: 'LOCAL' | 'REMOTE' | 'MERGED') => {
    setError('')
    setPending(true)
    try {
      if (choice === 'MERGED') {
        const parsed = mergedRecordSchema.parse(JSON.parse(merged)) as JsonObject
        await resolveConflict(conflict.id, { choice, data: parsed })
      } else {
        await resolveConflict(conflict.id, { choice })
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Ristiriidan ratkaisu epäonnistui.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="surface-card conflict-card">
      <h2>{conflict.table}</h2>
      <p>Tietue {conflict.entityId}</p>
      <div className="conflict-columns">
        <section>
          <h3>Tämän laitteen versio {conflict.localVersion}</h3>
          <pre>{JSON.stringify(conflict.localSnapshot, null, 2)}</pre>
          <button
            className="button button-secondary"
            disabled={pending}
            onClick={() => void resolve('LOCAL')}
          >
            Säilytä tämän laitteen versio
          </button>
        </section>
        <section>
          <h3>Pilven versio {conflict.remoteVersion}</h3>
          <pre>{JSON.stringify(conflict.remoteSnapshot, null, 2)}</pre>
          <button
            className="button button-secondary"
            disabled={pending}
            onClick={() => void resolve('REMOTE')}
          >
            Säilytä pilven versio
          </button>
        </section>
      </div>
      <label className="field">
        <span>Yhdistetty JSON-versio</span>
        <textarea
          rows={12}
          value={merged}
          onChange={(event) => setMerged(event.target.value)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button
        className="button button-primary"
        disabled={pending}
        onClick={() => void resolve('MERGED')}
      >
        Käytä yhdistettyä versiota
      </button>
    </article>
  )
}

export function SyncPage() {
  const { conflicts } = useSync()
  return (
    <div className="page-stack">
      <header className="section-heading">
        <p className="eyebrow">Synkronointi</p>
        <h1>Ristiriitojen ratkaisu</h1>
        <p>Kumpaakaan versiota ei poisteta ennen valintaasi.</p>
      </header>
      <SyncStatusCard />
      {conflicts.length === 0 ? (
        <section className="surface-card success-panel">
          <p>Avoimia ristiriitoja ei ole.</p>
        </section>
      ) : (
        conflicts.map((conflict) => (
          <ConflictCard conflict={conflict} key={conflict.id} />
        ))
      )}
    </div>
  )
}
