import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'
import { localDatabase } from '../../infrastructure/storage/localDatabase'
import { LocalWriteService } from '../../infrastructure/storage/localWriteService'
import { useAuth } from '../auth/authContextValue'
import { useSync } from '../sync/syncContextValue'
import { AppDataContext, type GoalChangeDraft } from './appDataContextValue'

const writeService = new LocalWriteService(localDatabase)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { deviceId, status } = useSync()
  const [records, setRecords] = useState<LocalRecord[]>([])
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [goalChangeDraft, setGoalChangeDraft] = useState<GoalChangeDraft | null>(null)

  const refresh = useCallback(async () => {
    if (!session) {
      await Promise.resolve()
      setRecords([])
      setLoadedUserId(null)
      return
    }
    const next = await localDatabase.records
      .where('userId')
      .equals(session.user.id)
      .filter((record) => record.deletedAt === null)
      .sortBy('updatedAt')
    setRecords(next)
    setLoadedUserId(session.user.id)
  }, [session])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Refresh updates state after its IndexedDB query or a microtask.
    void refresh()
  }, [refresh, status.lastSyncedAt])

  const create = useCallback(
    async (table: SyncableTable, data: JsonObject, id?: string) => {
      if (!session || !deviceId) throw new Error('Paikallinen laite ei ole vielä valmis.')
      const record = await writeService.create({
        userId: session.user.id,
        deviceId,
        table,
        data,
        id,
      })
      await refresh()
      return record
    },
    [deviceId, refresh, session],
  )

  const update = useCallback(
    async (record: LocalRecord, data: JsonObject) => {
      if (!deviceId) throw new Error('Paikallinen laite ei ole vielä valmis.')
      const next = await writeService.update({
        userId: record.userId,
        deviceId,
        table: record.table,
        id: record.id,
        data,
        expectedVersion: record.version,
      })
      await refresh()
      return next
    },
    [deviceId, refresh],
  )

  const remove = useCallback(
    async (record: LocalRecord) => {
      if (!deviceId) throw new Error('Paikallinen laite ei ole vielä valmis.')
      await writeService.remove({
        userId: record.userId,
        deviceId,
        table: record.table,
        id: record.id,
        expectedVersion: record.version,
      })
      await refresh()
    },
    [deviceId, refresh],
  )

  const value = useMemo(() => {
    const loading = Boolean(session && loadedUserId !== session.user.id)
    const list = (table: SyncableTable) =>
      records.filter((record) => record.table === table)
    const latest = (table: SyncableTable) => list(table).at(-1) ?? null
    return {
      records,
      loading,
      deviceId,
      goalChangeDraft,
      setGoalChangeDraft,
      list,
      latest,
      create,
      update,
      remove,
      refresh,
    }
  }, [
    create,
    deviceId,
    goalChangeDraft,
    loadedUserId,
    records,
    refresh,
    remove,
    session,
    update,
  ])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
