import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ConflictResolution, LocalDevice, SyncStatus } from '../../domain/sync/types'
import { SyncEngine } from '../../domain/sync/SyncEngine'
import { useAuth } from '../auth/authContextValue'
import { localDatabase } from '../../infrastructure/storage/localDatabase'
import { LocalSyncStore } from '../../infrastructure/storage/localSyncStore'
import { SupabaseSyncGateway } from '../../infrastructure/supabase/SupabaseSyncGateway'
import { supabase, supabasePublicConfig } from '../../infrastructure/supabase/client'
import { SyncContext } from './syncContextValue'

const deviceKeyStorage = 'treenikompassi.sync.device-key'

const initialStatus: SyncStatus = {
  state: navigator.onLine ? 'SYNCED' : 'OFFLINE',
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  errorMessage: null,
}

function deviceKey() {
  const existing = localStorage.getItem(deviceKeyStorage)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(deviceKeyStorage, created)
  return created
}

function deviceName() {
  if (/iPhone|iPad/u.test(navigator.userAgent)) return 'Apple-mobiililaite'
  if (/Android/u.test(navigator.userAgent)) return 'Android-laite'
  return 'Selainlaite'
}

const store = new LocalSyncStore(localDatabase)

function createEngine() {
  if (!supabase || !supabasePublicConfig) return null
  const configuredSupabase = supabase
  const gateway = new SupabaseSyncGateway({
    apiUrl: supabasePublicConfig.url,
    anonKey: supabasePublicConfig.anonKey,
    getAccessToken: async () => {
      const { data } = await configuredSupabase.auth.getSession()
      return data.session?.access_token ?? null
    },
  })
  return new SyncEngine(store, gateway)
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [engine] = useState(createEngine)
  const [status, setStatus] = useState(initialStatus)
  const [device, setDevice] = useState<LocalDevice | null>(null)
  const [conflicts, setConflicts] = useState<
    Awaited<ReturnType<typeof store.openConflicts>>
  >([])
  const activeDevice = session && device?.userId === session.user.id ? device : null

  const refreshConflicts = useCallback(async () => {
    if (!session) {
      setConflicts([])
      return
    }
    setConflicts(await store.openConflicts(session.user.id))
  }, [session])

  const runSync = useCallback(
    async (force = false) => {
      if (!session || !activeDevice || !engine) return
      await engine.sync({ userId: session.user.id, device: activeDevice, force })
      await refreshConflicts()
    },
    [activeDevice, engine, refreshConflicts, session],
  )

  useEffect(() => {
    if (!engine) return
    return engine.subscribe(setStatus)
  }, [engine])

  useEffect(() => {
    let active = true
    if (!session) return
    void store
      .ensureDevice(session.user.id, deviceKey(), deviceName())
      .then((nextDevice) => {
        if (active) setDevice(nextDevice)
      })
    void store.openConflicts(session.user.id).then((nextConflicts) => {
      if (active) setConflicts(nextConflicts)
    })
    return () => {
      active = false
    }
  }, [refreshConflicts, session])

  useEffect(() => {
    if (!activeDevice) return
    const timeout = window.setTimeout(() => void runSync(), 0)
    return () => window.clearTimeout(timeout)
  }, [activeDevice, runSync])

  useEffect(() => {
    const online = () => void runSync(true)
    const offline = () => void runSync()
    const visible = () => {
      if (document.visibilityState === 'visible') void runSync()
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [runSync])

  const resolveConflict = useCallback(
    async (id: string, resolution: ConflictResolution) => {
      await store.resolveConflict(id, resolution)
      await runSync(true)
      await refreshConflicts()
    },
    [refreshConflicts, runSync],
  )

  const value = useMemo(
    () => ({
      status,
      conflicts: session ? conflicts : [],
      deviceId: activeDevice?.id ?? null,
      syncNow: () => runSync(true),
      resolveConflict,
    }),
    [activeDevice?.id, conflicts, resolveConflict, runSync, session, status],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
