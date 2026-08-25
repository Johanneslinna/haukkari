import { localDatabase } from '../../infrastructure/storage/localDatabase'
import { unsubscribeCurrentDevice } from '../settings/webPush'

export async function clearLocalAccountData(userId: string) {
  await unsubscribeCurrentDevice().catch(() => undefined)
  await localDatabase.clearUserData(userId)
  if ('caches' in globalThis) {
    const names = await caches.keys()
    await Promise.all(names.map((name) => caches.delete(name)))
  }
  localStorage.removeItem('treenikompassi.theme')
}
