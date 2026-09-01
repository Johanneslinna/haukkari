import { afterEach, describe, expect, it } from 'vitest'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { TreenikompassiDatabase } from '../../infrastructure/storage/localDatabase'
import { LocalSyncStore } from '../../infrastructure/storage/localSyncStore'
import { LocalWriteService } from '../../infrastructure/storage/localWriteService'
import { FakeSyncRemoteGateway } from '../../test/fakes/FakeSyncRemoteGateway'
import type { LocalDevice, RemoteRecord } from './types'
import { SyncEngine } from './SyncEngine'

const user = '11111111-1111-4111-8111-111111111111'
const deviceA: LocalDevice = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: user,
  deviceKey: 'selain-a',
  displayName: 'Selain A',
  lastSeenAt: '2026-08-24T08:00:00.000Z',
}
const deviceB: LocalDevice = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: user,
  deviceKey: 'selain-b',
  displayName: 'Selain B',
  lastSeenAt: '2026-08-24T08:00:00.000Z',
}

const databases: TreenikompassiDatabase[] = []

function database(label: string) {
  const db = new TreenikompassiDatabase(`${label}-${crypto.randomUUID()}`, {
    indexedDB,
    IDBKeyRange,
  })
  databases.push(db)
  return db
}

function runtime(
  db: TreenikompassiDatabase,
  remote: FakeSyncRemoteGateway,
  online: () => boolean,
) {
  const store = new LocalSyncStore(db)
  const writes = new LocalWriteService(db)
  const engine = new SyncEngine(store, remote, { isOnline: online, pageSize: 1 })
  return { store, writes, engine }
}

function remoteRecord(id: string, updatedAt: string, notes: string): RemoteRecord {
  return {
    id,
    user_id: user,
    performed_at: updatedAt,
    notes,
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: null,
    version: 1,
  }
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()))
})

describe('SyncEngine', () => {
  it('jonottaa uuden synkronointipyynnön käynnissä olevan kierroksen perään', async () => {
    const db = database('queued')
    const remote = new FakeSyncRemoteGateway()
    const { engine } = runtime(db, remote, () => true)

    await Promise.all([
      engine.sync({ userId: user, device: deviceA }),
      engine.sync({ userId: user, device: deviceA, force: true }),
    ])

    expect(remote.prepareCalls).toBe(2)
  })

  it('jättää epäonnistuneen muutoksen outboxiin ja synkronoi yhteyden palatessa', async () => {
    const db = database('offline')
    const remote = new FakeSyncRemoteGateway()
    let online = false
    const { writes, engine } = runtime(db, remote, () => online)
    await writes.create({
      userId: user,
      deviceId: deviceA.id,
      table: 'workout_logs',
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      data: { performed_at: '2026-08-24T08:00:00.000Z' },
    })

    expect((await engine.sync({ userId: user, device: deviceA })).state).toBe('OFFLINE')
    expect(await db.outbox.count()).toBe(1)

    online = true
    remote.failBeforeApply = true
    const failed = await engine.sync({ userId: user, device: deviceA, force: true })
    expect(failed.state).toBe('ERROR')
    expect(await db.outbox.count()).toBe(1)

    const recovered = await engine.sync({ userId: user, device: deviceA, force: true })
    expect(recovered.state).toBe('SYNCED')
    expect(await db.outbox.count()).toBe(0)
    expect(remote.records.size).toBe(1)
  })

  it('ei luo kaksoiskappaletta, vaikka palvelimen kuittaus katoaa', async () => {
    const db = database('idempotent')
    const remote = new FakeSyncRemoteGateway()
    remote.loseAcknowledgement = true
    const { writes, engine } = runtime(db, remote, () => true)
    await writes.create({
      userId: user,
      deviceId: deviceA.id,
      table: 'nutrition_logs',
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      data: { logged_at: '2026-08-24T08:00:00.000Z', entry: { protein_g: 30 } },
    })

    await engine.sync({ userId: user, device: deviceA, force: true })
    await engine.sync({ userId: user, device: deviceA, force: true })

    expect(remote.records.size).toBe(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('säilyttää sarjakohtaisen RIR:n paikallisessa tallennuksessa ja synkronoinnissa', async () => {
    const db = database('rir-sync')
    const remote = new FakeSyncRemoteGateway()
    const { writes, engine } = runtime(db, remote, () => true)
    const id = 'abababab-abab-4bab-8bab-abababababab'
    await writes.create({
      userId: user,
      deviceId: deviceA.id,
      table: 'exercise_set_logs',
      id,
      data: {
        workout_log_id: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
        ordinal: 1,
        repetitions: 8,
        load_kg: 30,
        rir: 2,
      },
    })

    const local = await db.records.where('id').equals(id).first()
    expect(local?.data.rir).toBe(2)
    await engine.sync({ userId: user, device: deviceA })
    expect(remote.get('exercise_set_logs', id)?.rir).toBe(2)
  })

  it('säilyttää versionoidun tauolta paluun taustatiedon kahden laitteen synkronoinnissa', async () => {
    const dbA = database('return-background-a')
    const dbB = database('return-background-b')
    const remote = new FakeSyncRemoteGateway()
    const a = runtime(dbA, remote, () => true)
    const b = runtime(dbB, remote, () => true)
    const id = 'acacacac-acac-4cac-8cac-acacacacacac'
    const strengthTrainingBackground = {
      regularTrainingAtLeast12Weeks: true,
      lastStrengthWorkoutAt: '2026-06-18T12:00:00.000Z',
      source: 'USER_CONFIRMED',
      confirmedAt: '2026-08-27T08:00:00.000Z',
      policyVersion: 'adult-strength-return-1.0.0',
    }
    await a.writes.create({
      userId: user,
      deviceId: deviceA.id,
      table: 'profiles',
      id,
      data: {
        display_name: 'Aino',
        app_settings: { strengthTrainingBackground },
      },
    })

    await a.engine.sync({ userId: user, device: deviceA })
    await b.engine.sync({ userId: user, device: deviceB })

    expect(remote.get('profiles', id)?.app_settings).toEqual({
      strengthTrainingBackground,
    })
    const received = await dbB.records.where('id').equals(id).first()
    expect(received?.data.app_settings).toEqual({ strengthTrainingBackground })
  })

  it('vetää kaikki samalla aikaleimalla muuttuneet tietueet vakaalla kursorilla', async () => {
    const db = database('cursor')
    const remote = new FakeSyncRemoteGateway()
    const timestamp = '2026-08-24T09:00:00.000Z'
    remote.seed(
      'workout_logs',
      remoteRecord('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', timestamp, 'ensimmäinen'),
    )
    remote.seed(
      'workout_logs',
      remoteRecord('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', timestamp, 'toinen'),
    )
    const { engine } = runtime(db, remote, () => true)

    await engine.sync({ userId: user, device: deviceA })

    expect(
      await db.records.where('[userId+table]').equals([user, 'workout_logs']).count(),
    ).toBe(2)
  })

  it('säilyttää kahden laitteen rinnakkaismuutokset, ratkaisee konfliktin ja välittää tombstonen', async () => {
    const dbA = database('device-a')
    const dbB = database('device-b')
    const remote = new FakeSyncRemoteGateway()
    const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    remote.seed(
      'workout_logs',
      remoteRecord(id, '2026-08-24T08:00:00.000Z', 'alkuperäinen'),
    )
    const a = runtime(dbA, remote, () => true)
    const b = runtime(dbB, remote, () => true)
    await a.engine.sync({ userId: user, device: deviceA })
    await b.engine.sync({ userId: user, device: deviceB })

    await a.writes.update({
      userId: user,
      deviceId: deviceA.id,
      table: 'workout_logs',
      id,
      expectedVersion: 1,
      data: { notes: 'laitteen A muutos' },
    })
    await b.writes.update({
      userId: user,
      deviceId: deviceB.id,
      table: 'workout_logs',
      id,
      expectedVersion: 1,
      data: { notes: 'laitteen B muutos' },
    })
    await a.engine.sync({ userId: user, device: deviceA, force: true })
    const conflictStatus = await b.engine.sync({
      userId: user,
      device: deviceB,
      force: true,
    })

    expect(conflictStatus.state).toBe('CONFLICT')
    const conflicts = await b.store.openConflicts(user)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].localSnapshot.notes).toBe('laitteen B muutos')
    expect(conflicts[0].remoteSnapshot.notes).toBe('laitteen A muutos')

    await b.store.resolveConflict(conflicts[0].id, { choice: 'LOCAL' })
    await b.engine.sync({ userId: user, device: deviceB, force: true })
    expect(remote.get('workout_logs', id)?.notes).toBe('laitteen B muutos')
    expect(remote.get('workout_logs', id)?.version).toBe(3)

    await a.engine.sync({ userId: user, device: deviceA, force: true })
    await a.writes.remove({
      userId: user,
      deviceId: deviceA.id,
      table: 'workout_logs',
      id,
      expectedVersion: 3,
    })
    await a.engine.sync({ userId: user, device: deviceA, force: true })
    await b.engine.sync({ userId: user, device: deviceB, force: true })

    const onDeviceB = await dbB.records.where('id').equals(id).first()
    expect(onDeviceB?.deletedAt).not.toBeNull()
    expect(remote.get('workout_logs', id)?.deleted_at).not.toBeNull()
  })
})
