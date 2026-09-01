import { describe, expect, it } from 'vitest'
import {
  deterministicUuid,
  deterministicWeeklyPlanIds,
  HAUKKARI_WEEKLY_PLAN_NAMESPACE,
  weeklyMaterializationIdempotencyKey,
} from './DeterministicUuid'

describe('deterministicUuid', () => {
  it('tuottaa eri laitteilla toistettavan UUIDv5-tunnisteen', async () => {
    const name = 'weekly-plan:user:goal-period:2026-08-24:adult-strength-week-1.0.0'
    const first = await deterministicUuid(HAUKKARI_WEEKLY_PLAN_NAMESPACE, name)
    const second = await deterministicUuid(HAUKKARI_WEEKLY_PLAN_NAMESPACE, name)
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f-]{36}$/u)
    expect(first[14]).toBe('5')
  })

  it('sitoo viikkotunnisteet käyttäjään, tavoitejaksoon, viikkoon ja politiikkoihin', async () => {
    const input = {
      userId: '00000000-0000-4000-8000-000000000001',
      goalPeriodId: '00000000-0000-4000-8000-000000000002',
      weekAnchorDate: '2026-08-24',
      calendarPolicyVersion: 'local-calendar-1.0.0',
      strengthWeekPolicyVersion: 'adult-strength-week-1.0.0',
    }
    const first = await deterministicWeeklyPlanIds(input)
    expect(await deterministicWeeklyPlanIds(input)).toEqual(first)
    expect(
      await deterministicWeeklyPlanIds({ ...input, weekAnchorDate: '2026-08-31' }),
    ).not.toEqual(first)
  })

  it('muodostaa versionoidun viikkomaterialisoinnin idempotenssiavaimen', () => {
    expect(
      weeklyMaterializationIdempotencyKey({
        goalPeriodId: '11111111-1111-4111-8111-111111111111',
        weekAnchorDate: '2026-08-24',
        calendarPolicyVersion: 'local-calendar-1.0.0',
        strengthWeekPolicyVersion: 'adult-strength-week-1.0.0',
      }),
    ).toBe(
      'weekly:11111111-1111-4111-8111-111111111111:2026-08-24:local-calendar-1.0.0:adult-strength-week-1.0.0',
    )
  })
})
