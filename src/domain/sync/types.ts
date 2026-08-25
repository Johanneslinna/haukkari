export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue | undefined }

export const syncableTables = [
  'profiles',
  'health_screenings',
  'goal_profiles',
  'goal_periods',
  'plan_versions',
  'training_plans',
  'workout_templates',
  'workouts',
  'workout_exercises',
  'daily_checkins',
  'workout_logs',
  'exercise_set_logs',
  'run_logs',
  'nutrition_logs',
  'body_metrics',
  'sport_profiles',
  'fixed_sport_sessions',
  'competition_events',
  'baseline_tests',
  'reassessments',
  'reminders',
  'push_subscriptions',
] as const

export type SyncableTable = (typeof syncableTables)[number]
export type SyncOperationKind = 'INSERT' | 'UPDATE' | 'DELETE'
export type OutboxState = 'PENDING' | 'CONFLICT'
export type LocalSyncState = 'PENDING' | 'SYNCED' | 'CONFLICT'

export type RemoteRecord = JsonObject & {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  version: number
}

export type LocalRecord = {
  key: string
  entityKey: string
  id: string
  userId: string
  table: SyncableTable
  data: RemoteRecord
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  version: number
  syncState: LocalSyncState
}

export type OutboxOperation = {
  operationId: string
  userId: string
  deviceId: string
  entityKey: string
  entityId: string
  table: SyncableTable
  kind: SyncOperationKind
  baseVersion: number | null
  localVersion: number
  payload: RemoteRecord
  state: OutboxState
  attempts: number
  nextAttemptAt: string
  lastError: string | null
  createdAt: string
}

export type SyncCursor = {
  updatedAt: string
  id: string
}

export type SyncMetadata = {
  key: string
  userId: string
  table: SyncableTable
  cursor: SyncCursor | null
}

export type LocalSyncConflict = {
  id: string
  userId: string
  entityKey: string
  entityId: string
  table: SyncableTable
  operationId: string | null
  localVersion: number
  remoteVersion: number
  localSnapshot: RemoteRecord
  remoteSnapshot: RemoteRecord
  status: 'OPEN' | 'RESOLVED'
  resolution: 'LOCAL' | 'REMOTE' | 'MERGED' | null
  createdAt: string
  resolvedAt: string | null
}

export type LocalDevice = {
  id: string
  userId: string
  deviceKey: string
  displayName: string
  lastSeenAt: string
}

export type PushResult =
  | { outcome: 'APPLIED'; record: RemoteRecord }
  | { outcome: 'CONFLICT'; remoteRecord: RemoteRecord }
  | { outcome: 'RETRY'; message: string }

export type PullPage = {
  records: RemoteRecord[]
  hasMore: boolean
}

export type SyncRemoteGateway = {
  prepare: (userId: string, device: LocalDevice) => Promise<void>
  push: (operation: OutboxOperation) => Promise<PushResult>
  pull: (
    userId: string,
    table: SyncableTable,
    cursor: SyncCursor | null,
    limit: number,
  ) => Promise<PullPage>
}

export type SyncState = 'SYNCED' | 'SYNCING' | 'OFFLINE' | 'ERROR' | 'CONFLICT'

export type SyncStatus = {
  state: SyncState
  pendingCount: number
  conflictCount: number
  lastSyncedAt: string | null
  errorMessage: string | null
}

export type ConflictResolution =
  { choice: 'LOCAL' } | { choice: 'REMOTE' } | { choice: 'MERGED'; data: JsonObject }

export const recordKey = (userId: string, table: SyncableTable, id: string) =>
  `${userId}\u001f${table}\u001f${id}`

export const entityKey = (table: SyncableTable, id: string) => `${table}\u001f${id}`

export const metadataKey = (userId: string, table: SyncableTable) =>
  `${userId}\u001f${table}`
