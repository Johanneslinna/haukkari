import { describe, expect, it, vi } from 'vitest'
import { requestWebPushSubscription, SAFE_PUSH_BODY } from './webPush'

describe('Web Push opt-in', () => {
  it('does not block the app when notification permission is denied', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied')
    const result = await requestWebPushSubscription('unused', {
      notification: { permission: 'default', requestPermission },
      serviceWorker: {} as ServiceWorkerContainer,
    })
    expect(result).toEqual({ status: 'DENIED' })
    expect(requestPermission).toHaveBeenCalledOnce()
  })

  it('uses only the approved generic visible notification text', () => {
    expect(SAFE_PUSH_BODY).toBe('Päivän treenitarkistus odottaa.')
    expect(SAFE_PUSH_BODY).not.toMatch(/paino|kuukaut|uni|kipu|kalori|diagnoosi/iu)
  })
})
