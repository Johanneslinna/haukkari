import { createContext, useContext } from 'react'
import type { GoalChangePreview, GoalProfile } from '../../domain/coaching/types'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'

export type GoalChangeDraft = {
  profile: GoalProfile
  preview: GoalChangePreview
}

export type AppDataContextValue = {
  records: LocalRecord[]
  loading: boolean
  deviceId: string | null
  goalChangeDraft: GoalChangeDraft | null
  setGoalChangeDraft: (draft: GoalChangeDraft | null) => void
  list: (table: SyncableTable) => LocalRecord[]
  latest: (table: SyncableTable) => LocalRecord | null
  create: (table: SyncableTable, data: JsonObject, id?: string) => Promise<LocalRecord>
  update: (record: LocalRecord, data: JsonObject) => Promise<LocalRecord>
  remove: (record: LocalRecord) => Promise<void>
  refresh: () => Promise<void>
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('Sovelluksen datakonteksti puuttuu.')
  return context
}
