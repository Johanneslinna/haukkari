import {
  LOCAL_CALENDAR_POLICY_VERSION,
  STRENGTH_WEEK_POLICY_VERSION,
} from '../domain/coaching'
import {
  deterministicWeeklyPlanIds,
  weeklyMaterializationIdempotencyKey,
} from '../domain/sync/DeterministicUuid'
import type { JsonObject } from '../domain/sync/types'

export async function buildBrowserWeeklyMaterializationFixture(
  userId: string,
  input: {
    goalPeriodId: string
    weekAnchorDate: string
    writer?: string
  },
) {
  const policyVersions = {
    calendarPolicyVersion: LOCAL_CALENDAR_POLICY_VERSION,
    strengthWeekPolicyVersion: STRENGTH_WEEK_POLICY_VERSION,
  }
  const ids = await deterministicWeeklyPlanIds({
    userId,
    goalPeriodId: input.goalPeriodId,
    weekAnchorDate: input.weekAnchorDate,
    ...policyVersions,
  })
  const materialization = {
    idempotencyKey: weeklyMaterializationIdempotencyKey({
      goalPeriodId: input.goalPeriodId,
      weekAnchorDate: input.weekAnchorDate,
      ...policyVersions,
    }),
    trainingPlanId: ids.trainingPlanId,
    generatedAt: `${input.weekAnchorDate}T09:00:00.000Z`,
    localDate: input.weekAnchorDate,
    weekAnchorDate: input.weekAnchorDate,
    calendarTimeZone: 'Europe/Helsinki',
    ...policyVersions,
    changeReason: 'WEEKLY_MATERIALIZATION',
  } satisfies JsonObject
  const plan = {
    writer: input.writer ?? 'default-device',
    sessions: [],
    strengthWeek: {
      policyVersion: policyVersions.strengthWeekPolicyVersion,
      weekAnchorDate: input.weekAnchorDate,
      status: 'SUPPORTED',
      reasonCodes: ['STRENGTH_WEEK_FULLY_SUPPORTED'],
    },
  } satisfies JsonObject

  return { ids, materialization, plan }
}
