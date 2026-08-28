import { describe, expect, it } from 'vitest'
import { generatePlan } from '../../domain/coaching/PlanGenerator'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'
import { planSessions, planStrengthWeek } from '../coaching/coachingData'
import {
  adaptWorkoutPrescriptionForCurrentAthlete,
  authorizeWorkoutPrescriptionForCurrentAthlete,
} from '../workout/WorkoutPrescriptionAdapter'

const now = '2026-08-27T08:00:00.000Z'
const userId = '00000000-0000-4000-8000-000000000001'

function record(table: SyncableTable, data: JsonObject): LocalRecord {
  const id = crypto.randomUUID()
  return {
    key: `${table}-${id}`,
    entityKey: `${table}-${id}`,
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

function plan() {
  return generatePlan({
    goal: { primary: 'GENERAL_FITNESS', secondary: [], inputs: {} },
    experience: 'INTERMEDIATE',
    availableDays: [1, 4],
    currentEnduranceMinutes: 0,
    fixedSessions: [],
    competitions: [],
    equipment: ['Kehonpaino', 'Käsipainot'],
    physicalLoad: 'MODERATE',
    minutesPerSession: 45,
    minutesByDay: { '1': 45, '4': 45 },
    age: 35,
    generatedAt: now,
    calendarTimeZone: 'Europe/Helsinki',
    localDate: '2026-08-27',
    weekAnchorDate: '2026-08-24',
  }).decision
}

describe('voimaviikon tuotantopolku', () => {
  it('säilyttää saman blueprintin JSON-snapshotissa, esikatselussa ja suorituksen valtuutuksessa', () => {
    const originalPlan = plan()
    const snapshot = JSON.parse(JSON.stringify(originalPlan)) as JsonObject
    const previewSession = planSessions(snapshot).find(
      (session) => session.kind === 'STRENGTH',
    )
    expect(planStrengthWeek(snapshot)?.policyVersion).toBe('adult-strength-week-1.0.0')
    expect(previewSession?.strengthWeekContext?.role).toBe('FULL_BODY_A')
    const prescription = previewSession!.prescriptionDetail!
    const authorized = authorizeWorkoutPrescriptionForCurrentAthlete({
      prescription,
      profile: record('profiles', { birth_date: '1991-05-01' }),
      screening: record('health_screenings', { status: 'CLEAR', answers: {} }),
      readiness: 'GREEN',
      today: '2026-08-27',
    })
    expect(authorized.status).toBe('SUPPORTED')
    if (authorized.status !== 'SUPPORTED') throw new Error(authorized.reasonCode)
    expect(authorized.prescription).toEqual(prescription)
    expect(authorized.prescription.decisionTrace.strengthWeek).toEqual(
      previewSession?.strengthWeekContext,
    )
  })

  it('päivän kevennys säilyttää viikkokontekstin ja kirjaa perustellun eron', () => {
    const session = plan().sessions.find((item) => item.kind === 'STRENGTH')!
    const adapted = adaptWorkoutPrescriptionForCurrentAthlete({
      prescription: session.prescriptionDetail!,
      variant: {
        kind: 'LIGHT',
        timeBudgetMinutes: 45,
        durationMinutes: 45,
        volumeMultiplier: 0.65,
      },
      profile: record('profiles', { birth_date: '1991-05-01' }),
      screening: record('health_screenings', { status: 'CLEAR', answers: {} }),
      readiness: 'YELLOW',
      today: '2026-08-27',
    })
    expect(adapted.status).toBe('SUPPORTED')
    if (adapted.status !== 'SUPPORTED') throw new Error(adapted.reasonCode)
    expect(adapted.prescription.decisionTrace.strengthWeek).toEqual(
      session.strengthWeekContext,
    )
    expect(adapted.prescription.decisionTrace.adaptations?.length).toBeGreaterThan(0)
  })

  it('lukee legacy-suunnitelman ilman strengthWeek-kenttää', () => {
    const legacy = {
      sessions: plan().sessions.map(
        ({ strengthWeekContext: _context, ...session }) => session,
      ),
    }
    expect(planStrengthWeek(legacy as unknown as JsonObject)).toBeNull()
    expect(planSessions(legacy as unknown as JsonObject).length).toBeGreaterThan(0)
  })
})
