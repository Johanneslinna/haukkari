import { describe, expect, it } from 'vitest'
import {
  LOCAL_CALENDAR_POLICY_VERSION,
  STRENGTH_WEEK_POLICY_VERSION,
} from '../domain/coaching'
import {
  deterministicWeeklyPlanIds,
  weeklyMaterializationIdempotencyKey,
} from '../domain/sync/DeterministicUuid'
import { buildBrowserWeeklyMaterializationFixture } from './browserWeeklyMaterializationFixture'

describe('browserWeeklyMaterializationFixture', () => {
  it('käyttää payloadissa, idempotenssiavaimessa ja tunnisteissa samoja politiikkaversioita', async () => {
    const userId = '00000000-0000-4000-8000-000000000001'
    const goalPeriodId = '00000000-0000-4000-8000-000000000002'
    const weekAnchorDate = '2026-08-31'
    const fixture = await buildBrowserWeeklyMaterializationFixture(userId, {
      goalPeriodId,
      weekAnchorDate,
    })
    const { materialization, plan } = fixture

    expect(materialization.calendarPolicyVersion).toBe(LOCAL_CALENDAR_POLICY_VERSION)
    expect(materialization.strengthWeekPolicyVersion).toBe(STRENGTH_WEEK_POLICY_VERSION)
    expect(materialization.idempotencyKey).toBe(
      weeklyMaterializationIdempotencyKey({
        goalPeriodId,
        weekAnchorDate,
        calendarPolicyVersion: materialization.calendarPolicyVersion,
        strengthWeekPolicyVersion: materialization.strengthWeekPolicyVersion,
      }),
    )
    expect(fixture.ids).toEqual(
      await deterministicWeeklyPlanIds({
        userId,
        goalPeriodId,
        weekAnchorDate,
        calendarPolicyVersion: materialization.calendarPolicyVersion,
        strengthWeekPolicyVersion: materialization.strengthWeekPolicyVersion,
      }),
    )
    expect(plan.strengthWeek.policyVersion).toBe(
      materialization.strengthWeekPolicyVersion,
    )
  })
})
