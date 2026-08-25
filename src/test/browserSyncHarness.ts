import { recordKey } from '../domain/sync/types'
import { localDatabase } from '../infrastructure/storage/localDatabase'
import { LocalWriteService } from '../infrastructure/storage/localWriteService'

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
  }
  window.__treenikompassiSyncTest = harness
}

declare global {
  interface Window {
    __treenikompassiSyncTest?: BrowserSyncHarness
  }
}
