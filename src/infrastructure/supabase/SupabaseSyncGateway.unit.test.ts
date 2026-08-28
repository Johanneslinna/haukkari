import { describe, expect, it } from 'vitest'
import { trainingPlanInsertPayloadSchema } from './SupabaseSyncGateway'

const validTrainingPlanPayload = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  plan_version_id: '33333333-3333-4333-8333-333333333333',
  week_count: 1,
  status: 'ACTIVE',
  plan: { sessions: [] },
  created_at: '2026-08-28T09:00:00.000Z',
  updated_at: '2026-08-28T09:00:00.000Z',
  deleted_at: null,
  version: 1,
} as const

describe('training_plans-synkronointisopimus', () => {
  it('hyväksyy vain taulun sallitut insert-kentät', () => {
    expect(trainingPlanInsertPayloadSchema.parse(validTrainingPlanPayload)).toEqual(
      validTrainingPlanPayload,
    )
  })

  it('estää plan_versions-tauluun kuuluvan change_reason-kentän', () => {
    const result = trainingPlanInsertPayloadSchema.safeParse({
      ...validTrainingPlanPayload,
      change_reason: 'WEEKLY_MATERIALIZATION',
    })
    expect(result.success).toBe(false)
  })
})
