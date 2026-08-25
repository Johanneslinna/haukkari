import { createContext, useContext } from 'react'
import type {
  ConflictResolution,
  LocalSyncConflict,
  SyncStatus,
} from '../../domain/sync/types'

export type SyncContextValue = {
  status: SyncStatus
  conflicts: LocalSyncConflict[]
  deviceId: string | null
  syncNow: () => Promise<void>
  resolveConflict: (id: string, resolution: ConflictResolution) => Promise<void>
}

export const SyncContext = createContext<SyncContextValue | null>(null)

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) throw new Error('Synkronointikonteksti puuttuu.')
  return context
}
