import { StrictMode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '../app/AppShell'
import type { PlannedSession, ReadinessState } from '../domain/coaching/types'
import type {
  JsonObject,
  LocalRecord,
  SyncStatus,
  SyncableTable,
} from '../domain/sync/types'
import {
  AppDataContext,
  type AppDataContextValue,
} from '../features/app-data/appDataContextValue'
import { SyncContext, type SyncContextValue } from '../features/sync/syncContextValue'
import { TodayPage } from '../features/today/TodayPage'

type VisualTodayState =
  | 'normal'
  | 'light'
  | 'recovery'
  | 'red-stop'
  | 'offline'
  | 'sync-error'
  | 'loading'
  | 'empty'
  | 'complete'

const visualStates = new Set<VisualTodayState>([
  'normal',
  'light',
  'recovery',
  'red-stop',
  'offline',
  'sync-error',
  'loading',
  'empty',
  'complete',
])

const userId = '55555555-5555-4555-8555-555555555555'
const deviceId = 'visual-device'

function requestedState() {
  const value = new URLSearchParams(window.location.search).get('today-state')
  return visualStates.has(value as VisualTodayState)
    ? (value as VisualTodayState)
    : 'normal'
}

function record(table: SyncableTable, id: string, data: JsonObject): LocalRecord {
  const now = new Date().toISOString()
  return {
    key: `${userId}\u001f${table}\u001f${id}`,
    entityKey: `${table}\u001f${id}`,
    id,
    userId,
    table,
    data: {
      id,
      user_id: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
      ...data,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    syncState: 'SYNCED',
  }
}

function sessions(): PlannedSession[] {
  const today = new Date().getDay() || 7
  const next = (today % 7) + 1
  const later = ((today + 2) % 7) + 1
  return [
    {
      id: 'today-strength',
      day: today,
      kind: 'STRENGTH',
      title: 'Koko kehon voima',
      prescription: [
        'Lämmittely ja hallinta',
        'Kyykkyvariaatio',
        'Vaakasuuntainen työntö',
        'Vaakasuuntainen veto',
        'Rauhallinen loppuverryttely',
      ],
      durationMinutes: 42,
      intensity: 'MODERATE',
      loadRegion: 'FULL_BODY',
      fixed: false,
      source: 'APP',
      variants: [
        { kind: 'FULL', durationMinutes: 42, volumeMultiplier: 1 },
        { kind: 'LIGHT', durationMinutes: 28, volumeMultiplier: 0.65 },
        { kind: 'COMPACT_10', durationMinutes: 10, volumeMultiplier: 0.3 },
        { kind: 'COMPACT_20', durationMinutes: 20, volumeMultiplier: 0.5 },
        { kind: 'COMPACT_30', durationMinutes: 30, volumeMultiplier: 0.72 },
      ],
    },
    {
      id: 'next-endurance',
      day: next,
      kind: 'EASY_ENDURANCE',
      title: 'Rauhallinen peruskestävyys',
      prescription: ['Tasainen kevyt vauhti', 'Rauhallinen hengitys'],
      durationMinutes: 35,
      intensity: 'EASY',
      loadRegion: 'CARDIO',
      fixed: false,
      source: 'APP',
    },
    {
      id: 'later-mobility',
      day: later,
      kind: 'MOBILITY',
      title: 'Liikkuvuus ja hallinta',
      prescription: ['Lonkan hallinta', 'Rintarangan liikkuvuus'],
      durationMinutes: 25,
      intensity: 'EASY',
      loadRegion: 'FULL_BODY',
      fixed: false,
      source: 'APP',
    },
  ]
}

function readinessFor(state: VisualTodayState): ReadinessState {
  if (state === 'light') return 'YELLOW'
  if (state === 'recovery') return 'ORANGE_RECOVERY'
  if (state === 'red-stop') return 'RED_STOP'
  return 'GREEN'
}

function fixtureRecords(state: VisualTodayState) {
  const today = new Date().toISOString().slice(0, 10)
  const records = [
    record('profiles', 'visual-profile', {
      display_name: 'Aino',
      onboarding_completed: true,
    }),
    record('goal_profiles', 'visual-goal', {
      primary_goal: 'GENERAL_FITNESS',
      secondary_goals: [],
    }),
  ]
  if (state !== 'empty') {
    records.push(
      record('training_plans', 'visual-plan', {
        status: 'ACTIVE',
        week_count: 4,
        plan: {
          goal: 'GENERAL_FITNESS',
          sessions: sessions(),
          startingEnduranceMinutes: 20,
          assessments: [],
        },
      }),
      record('daily_checkins', 'visual-checkin', {
        checkin_date: today,
        readiness: readinessFor(state),
        answers: {},
        reasons: [],
      }),
    )
  }
  if (state === 'complete') {
    records.push(
      record('workout_logs', 'visual-workout-log', {
        performed_at: `${today}T08:15:00.000Z`,
        duration_minutes: 42,
        rpe: 6,
        notes: '',
      }),
    )
  }
  return records
}

function appDataValue(state: VisualTodayState): AppDataContextValue {
  const records = fixtureRecords(state)
  const list = (table: SyncableTable) =>
    records.filter((candidate) => candidate.table === table)
  const unavailable = async (): Promise<LocalRecord> => {
    throw new Error('Visuaalinen testiharness on vain luku -tilassa.')
  }
  return {
    records,
    loading: state === 'loading',
    deviceId,
    goalChangeDraft: null,
    setGoalChangeDraft: () => undefined,
    list,
    latest: (table) => list(table).at(-1) ?? null,
    create: unavailable,
    update: unavailable,
    remove: async () => undefined,
    refresh: async () => undefined,
  }
}

function syncValue(state: VisualTodayState): SyncContextValue {
  const status: SyncStatus = {
    state: state === 'offline' ? 'OFFLINE' : state === 'sync-error' ? 'ERROR' : 'SYNCED',
    pendingCount: state === 'offline' ? 2 : 0,
    conflictCount: 0,
    lastSyncedAt: state === 'offline' ? null : new Date().toISOString(),
    errorMessage:
      state === 'sync-error'
        ? 'Palvelimeen ei juuri nyt saada yhteyttä. Yritä hetken kuluttua uudelleen.'
        : null,
  }
  return {
    status,
    conflicts: [],
    deviceId,
    syncNow: async () => undefined,
    resolveConflict: async () => undefined,
  }
}

export function VisualTodayHarness() {
  const state = requestedState()
  return (
    <StrictMode>
      <BrowserRouter>
        <SyncContext.Provider value={syncValue(state)}>
          <AppDataContext.Provider value={appDataValue(state)}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="*" element={<TodayPage />} />
              </Route>
            </Routes>
          </AppDataContext.Provider>
        </SyncContext.Provider>
      </BrowserRouter>
    </StrictMode>
  )
}
