import { localDatabase } from '../../infrastructure/storage/localDatabase'
import type { AppDataContextValue } from '../app-data/appDataContextValue'
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

export async function resetTrainingProfileData(
  data: Pick<AppDataContextValue, 'records' | 'remove'>,
  unsubscribe: () => Promise<void> = unsubscribeCurrentDevice,
) {
  await unsubscribe().catch(() => undefined)
  const records = [...data.records].reverse()
  for (const record of records) await data.remove(record)
  return records.length
}
