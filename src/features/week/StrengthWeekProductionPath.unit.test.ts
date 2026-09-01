import { describe, expect, it } from 'vitest'
import { generatePlan } from '../../domain/coaching/PlanGenerator'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'
import {
  planSessions,
  planStrengthWeek,
  prescriptionDecisionReasons,
  prescriptionTimeBreakdownItems,
  sessionTotalDurationMinutes,
} from '../coaching/coachingData'
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

function plan(minutesPerSession = 45) {
  return generatePlan({
    goal: { primary: 'GENERAL_FITNESS', secondary: [], inputs: {} },
    experience: 'INTERMEDIATE',
    availableDays: [1, 4],
    currentEnduranceMinutes: 0,
    fixedSessions: [],
    competitions: [],
    equipment: ['Kehonpaino', 'Käsipainot'],
    physicalLoad: 'MODERATE',
    minutesPerSession,
    minutesByDay: { '1': minutesPerSession, '4': minutesPerSession },
    age: 35,
    generatedAt: now,
    calendarTimeZone: 'Europe/Helsinki',
    localDate: '2026-08-27',
    weekAnchorDate: '2026-08-24',
  }).decision
}

describe('voimaviikon tuotantopolku', () => {
  it('laskee päiväkohtaisesta aikabudjetista koko harjoituksen keston kaikkine osineen', () => {
    const session = plan(90).sessions.find((item) => item.kind === 'STRENGTH')!
    const prescription = session.prescriptionDetail!
    const breakdown = prescription.timeBreakdown!

    expect(session.timeBudgetMinutes).toBe(90)
    expect(prescription.timeBudgetMinutes).toBe(90)
    expect(sessionTotalDurationMinutes(session)).toBe(
      Math.ceil(breakdown.totalSeconds / 60),
    )
    expect(session.durationMinutes).toBe(sessionTotalDurationMinutes(session))
    expect(breakdown).toMatchObject({
      warmupSeconds: expect.any(Number),
      exerciseWarmupSeconds: expect.any(Number),
      workSeconds: expect.any(Number),
      restSeconds: expect.any(Number),
      transitionSeconds: expect.any(Number),
      equipmentSetupSeconds: expect.any(Number),
      cooldownSeconds: expect.any(Number),
      bufferSeconds: expect.any(Number),
    })
    for (const value of [
      breakdown.warmupSeconds,
      breakdown.exerciseWarmupSeconds,
      breakdown.workSeconds,
      breakdown.restSeconds,
      breakdown.transitionSeconds,
      breakdown.equipmentSetupSeconds,
      breakdown.cooldownSeconds,
      breakdown.bufferSeconds,
    ]) {
      expect(value).toBeGreaterThan(0)
    }
    expect(
      prescriptionTimeBreakdownItems(prescription).map((item) => item.label),
    ).toEqual([
      'Yleislämmittely',
      'Liikekohtaiset lämmittelysarjat',
      'Työsarjat',
      'Sarjapalautukset',
      'Liikkeiden vaihdot ja välineiden säädöt',
      'Loppuverryttely',
      'Aikapuskuri',
    ])

    const repeatedTechnicalReason =
      'Annostus pysyy julkaistun aikuisten voimaharjoittelusäännön sisällä.'
    expect(
      prescription.decisionTrace.rules.filter(
        (rule) => rule.message === repeatedTechnicalReason,
      ).length,
    ).toBeGreaterThan(1)
    const userReasons = prescriptionDecisionReasons(prescription)
    expect(new Set(userReasons).size).toBe(userReasons.length)
    expect(userReasons).not.toContain(repeatedTechnicalReason)
    expect(
      userReasons.filter(
        (reason) =>
          reason ===
          'Liikkeet ja sarjamäärät on sovitettu viikon turvalliseen kokonaiskuormaan.',
      ),
    ).toHaveLength(1)
    expect(userReasons[0]).toContain('koko kehon harjoitus')
  })

  it('säilyttää saman blueprintin JSON-snapshotissa, esikatselussa ja suorituksen valtuutuksessa', () => {
    const originalPlan = plan()
    const snapshot = JSON.parse(JSON.stringify(originalPlan)) as JsonObject
    const previewSession = planSessions(snapshot).find(
      (session) => session.kind === 'STRENGTH',
    )
    expect(planStrengthWeek(snapshot)?.policyVersion).toBe('adult-strength-week-1.5.0')
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
