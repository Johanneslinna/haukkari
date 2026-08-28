import { recordKey } from '../domain/sync/types'
import type { JsonObject } from '../domain/sync/types'
import { localDatabase } from '../infrastructure/storage/localDatabase'
import { LocalWriteService } from '../infrastructure/storage/localWriteService'
import {
  deterministicWeeklyPlanIds,
  weeklyMaterializationIdempotencyKey,
} from '../domain/sync/DeterministicUuid'
import {
  LOCAL_CALENDAR_POLICY_VERSION,
  STRENGTH_WEEK_POLICY_VERSION,
} from '../domain/coaching'

const writes = new LocalWriteService(localDatabase)

async function deviceId(userId: string) {
  const device = await localDatabase.devices.where('userId').equals(userId).first()
  if (!device) throw new Error('Synkronointilaitetta ei ole vielä rekisteröity.')
  return device.id
}

export type BrowserSyncHarness = {
  createWorkout: (userId: string, notes: string) => Promise<string>
  updateWorkout: (userId: string, id: string, notes: string) => Promise<void>
  deleteWorkout: (userId: string, id: string) => Promise<void>
  getWorkout: (userId: string, id: string) => Promise<unknown>
  outboxCount: (userId: string) => Promise<number>
  createWeeklyMaterialization: (
    userId: string,
    input: {
      goalPeriodId: string
      weekAnchorDate: string
      writer?: string
    },
  ) => Promise<{ planVersionId: string; trainingPlanId: string }>
  getWeeklyMaterialization: (
    userId: string,
    planVersionId: string,
    trainingPlanId: string,
  ) => Promise<unknown>
}

export function installBrowserSyncHarness() {
  const harness: BrowserSyncHarness = {
    async createWorkout(userId, notes) {
      const record = await writes.create({
        userId,
        deviceId: await deviceId(userId),
        table: 'workout_logs',
        data: { performed_at: new Date().toISOString(), notes },
      })
      return record.id
    },
    async updateWorkout(userId, id, notes) {
      const record = await localDatabase.records.get(
        recordKey(userId, 'workout_logs', id),
      )
      if (!record) throw new Error('Harjoitusmerkintää ei löytynyt.')
      await writes.update({
        userId,
        deviceId: await deviceId(userId),
        table: 'workout_logs',
        id,
        data: { notes },
        expectedVersion: record.version,
      })
    },
    async deleteWorkout(userId, id) {
      const record = await localDatabase.records.get(
        recordKey(userId, 'workout_logs', id),
      )
      if (!record) throw new Error('Harjoitusmerkintää ei löytynyt.')
      await writes.remove({
        userId,
        deviceId: await deviceId(userId),
        table: 'workout_logs',
        id,
        expectedVersion: record.version,
      })
    },
    async getWorkout(userId, id) {
      return localDatabase.records.get(recordKey(userId, 'workout_logs', id))
    },
    outboxCount(userId) {
      return localDatabase.outbox.where('userId').equals(userId).count()
    },
    async createWeeklyMaterialization(userId, input) {
      const ids = await deterministicWeeklyPlanIds({
        userId,
        goalPeriodId: input.goalPeriodId,
        weekAnchorDate: input.weekAnchorDate,
        calendarPolicyVersion: LOCAL_CALENDAR_POLICY_VERSION,
        strengthWeekPolicyVersion: STRENGTH_WEEK_POLICY_VERSION,
      })
      const materialization = {
        idempotencyKey: weeklyMaterializationIdempotencyKey({
          goalPeriodId: input.goalPeriodId,
          weekAnchorDate: input.weekAnchorDate,
          calendarPolicyVersion: LOCAL_CALENDAR_POLICY_VERSION,
          strengthWeekPolicyVersion: STRENGTH_WEEK_POLICY_VERSION,
        }),
        trainingPlanId: ids.trainingPlanId,
        generatedAt: `${input.weekAnchorDate}T09:00:00.000Z`,
        localDate: input.weekAnchorDate,
        weekAnchorDate: input.weekAnchorDate,
        calendarTimeZone: 'Europe/Helsinki',
        calendarPolicyVersion: 'local-calendar-1.0.0',
        strengthWeekPolicyVersion: 'adult-strength-week-1.0.0',
        changeReason: 'WEEKLY_MATERIALIZATION',
      }
      const plan = {
        writer: input.writer ?? 'default-device',
        sessions: [],
        strengthWeek: {
          policyVersion: 'adult-strength-week-1.0.0',
          weekAnchorDate: input.weekAnchorDate,
          status: 'SUPPORTED',
          reasonCodes: ['STRENGTH_WEEK_FULLY_SUPPORTED'],
        },
      } satisfies JsonObject
      await writes.create({
        userId,
        deviceId: await deviceId(userId),
        table: 'plan_versions',
        id: ids.planVersionId,
        data: {
          goal_period_id: input.goalPeriodId,
          previous_plan_version_id: null,
          version_number: 1,
          effective_from: input.weekAnchorDate,
          change_reason: 'WEEKLY_MATERIALIZATION',
          snapshot: { plan, materialization },
        },
      })
      await writes.create({
        userId,
        deviceId: await deviceId(userId),
        table: 'training_plans',
        id: ids.trainingPlanId,
        data: {
          plan_version_id: ids.planVersionId,
          week_count: 1,
          status: 'ACTIVE',
          plan,
        },
      })
      return ids
    },
    async getWeeklyMaterialization(userId, planVersionId, trainingPlanId) {
      const [version, plan] = await Promise.all([
        localDatabase.records.get(recordKey(userId, 'plan_versions', planVersionId)),
        localDatabase.records.get(recordKey(userId, 'training_plans', trainingPlanId)),
      ])
      return { version, plan }
    },
  }
  window.__treenikompassiSyncTest = harness
}

declare global {
  interface Window {
    __treenikompassiSyncTest?: BrowserSyncHarness
  }
}
