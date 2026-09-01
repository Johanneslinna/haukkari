import { describe, expect, it, vi } from 'vitest'
import type { LocalRecord } from '../../domain/sync/types'
import { resetTrainingProfileData } from './localPrivacy'

function record(id: string): LocalRecord {
  return {
    key: id,
    entityKey: id,
    id,
    userId: '00000000-0000-4000-8000-000000000001',
    table: 'profiles',
    data: {
      id,
      user_id: '00000000-0000-4000-8000-000000000001',
      created_at: '2026-08-25T00:00:00.000Z',
      updated_at: '2026-08-25T00:00:00.000Z',
      deleted_at: null,
      version: 1,
    },
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    syncState: 'SYNCED',
  }
}

describe('resetTrainingProfileData', () => {
  it('kirjoittaa jokaisesta nykyisestä tietueesta synkronoitavan poiston', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const unsubscribe = vi.fn().mockResolvedValue(undefined)
    const records = [
      record('00000000-0000-4000-8000-000000000010'),
      record('00000000-0000-4000-8000-000000000020'),
    ]

    await expect(
      resetTrainingProfileData({ records, remove }, unsubscribe),
    ).resolves.toBe(2)
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(remove.mock.calls.map(([value]) => value.id)).toEqual([
      '00000000-0000-4000-8000-000000000020',
      '00000000-0000-4000-8000-000000000010',
    ])
  })
})
