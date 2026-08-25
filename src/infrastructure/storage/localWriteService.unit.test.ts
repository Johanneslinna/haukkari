import { afterEach, describe, expect, it } from 'vitest'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { TreenikompassiDatabase } from './localDatabase'
import { LocalWriteService } from './localWriteService'

const userA = '11111111-1111-4111-8111-111111111111'
const userB = '22222222-2222-4222-8222-222222222222'
const device = '33333333-3333-4333-8333-333333333333'

const databases: TreenikompassiDatabase[] = []

function database(name = `local-write-${crypto.randomUUID()}`) {
  const result = new TreenikompassiDatabase(name, { indexedDB, IDBKeyRange })
  databases.push(result)
  return result
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((item) => item.delete()))
})

describe('LocalWriteService', () => {
  it('tallentaa tietueen ja idempotentin operaation samaan paikalliseen kantaan', async () => {
    const db = database()
    const service = new LocalWriteService(db, {
      now: () => new Date('2026-08-24T08:00:00.000Z'),
      uuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })

    const record = await service.create({
      userId: userA,
      deviceId: device,
      table: 'workout_logs',
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      data: { performed_at: '2026-08-24T07:00:00.000Z', notes: 'Offline-treeni' },
    })

    expect(record.syncState).toBe('PENDING')
    expect(await db.records.count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
    expect((await db.outbox.toArray())[0]).toMatchObject({
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'INSERT',
      entityId: record.id,
    })
  })

  it('säilyttää offline-tiedon kannan sulkemisen jälkeen ja välittää poiston tombstonena', async () => {
    const name = `restart-${crypto.randomUUID()}`
    const first = database(name)
    const ids = [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ]
    const firstService = new LocalWriteService(first, {
      now: () => new Date('2026-08-24T08:00:00.000Z'),
      uuid: () => ids.shift() ?? crypto.randomUUID(),
    })
    const created = await firstService.create({
      userId: userA,
      deviceId: device,
      table: 'body_metrics',
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      data: { measured_on: '2026-08-24', weight_kg: 60 },
    })
    first.close()

    const reopened = database(name)
    const persisted = await reopened.records.get(created.key)
    expect(persisted?.data.weight_kg).toBe(60)
    const secondService = new LocalWriteService(reopened, {
      now: () => new Date('2026-08-24T09:00:00.000Z'),
      uuid: () => ids.shift() ?? crypto.randomUUID(),
    })
    const removed = await secondService.remove({
      userId: userA,
      deviceId: device,
      table: 'body_metrics',
      id: created.id,
      expectedVersion: 1,
    })
    expect(removed.deletedAt).toBe('2026-08-24T09:00:00.000Z')
    expect(removed.data.deleted_at).toBe(removed.deletedAt)
    expect(await reopened.outbox.count()).toBe(2)
  })

  it('tyhjentää uloskirjautuvan käyttäjän tiedot mutta ei toisen käyttäjän tietoja', async () => {
    const db = database()
    let sequence = 0
    const service = new LocalWriteService(db, {
      uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    })
    await service.create({ userId: userA, deviceId: device, table: 'reminders' })
    await service.create({ userId: userB, deviceId: device, table: 'reminders' })

    await db.clearUserData(userA)

    expect(await db.records.where('userId').equals(userA).count()).toBe(0)
    expect(await db.outbox.where('userId').equals(userA).count()).toBe(0)
    expect(await db.records.where('userId').equals(userB).count()).toBe(1)
  })
})
