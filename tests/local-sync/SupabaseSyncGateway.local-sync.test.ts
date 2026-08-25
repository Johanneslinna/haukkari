import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  LocalDevice,
  OutboxOperation,
  RemoteRecord,
} from '../../src/domain/sync/types'
import { SupabaseSyncGateway } from '../../src/infrastructure/supabase/SupabaseSyncGateway'

const apiUrl = process.env.LOCAL_SUPABASE_API_URL ?? ''
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? ''
const adminKey = process.env.LOCAL_SUPABASE_ADMIN_KEY ?? ''
const password = 'Haukkari-sync-2026!'
const email = `sync-${Date.now()}-${randomUUID()}@example.invalid`

const admin = createClient(apiUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const userClient = createClient(apiUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let userId = ''

beforeAll(async () => {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error || !created.data.user) {
    throw new Error(
      created.error?.message ?? 'Synkronointitestikäyttäjää ei voitu luoda.',
    )
  }
  userId = created.data.user.id
  const signedIn = await userClient.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw new Error(signedIn.error.message)
})

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId)
})

describe('SupabaseSyncGateway paikallisessa Supabasessa', () => {
  it('toteuttaa idempotentin pushin, version konfliktin ja vakaan pull-kursorin', async () => {
    const gateway = new SupabaseSyncGateway({
      apiUrl,
      anonKey,
      getAccessToken: async () => {
        const { data } = await userClient.auth.getSession()
        return data.session?.access_token ?? null
      },
    })
    const device: LocalDevice = {
      id: randomUUID(),
      userId,
      deviceKey: `test-${randomUUID()}`,
      displayName: 'Paikallinen sopimustesti',
      lastSeenAt: new Date().toISOString(),
    }
    await gateway.prepare(userId, device)

    const entityId = randomUUID()
    const timestamp = new Date().toISOString()
    const insertedRecord: RemoteRecord = {
      id: entityId,
      user_id: userId,
      performed_at: timestamp,
      notes: 'ensimmäinen versio',
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      version: 1,
    }
    const insertOperation: OutboxOperation = {
      operationId: randomUUID(),
      userId,
      deviceId: device.id,
      entityKey: `workout_logs\u001f${entityId}`,
      entityId,
      table: 'workout_logs',
      kind: 'INSERT',
      baseVersion: null,
      localVersion: 1,
      payload: insertedRecord,
      state: 'PENDING',
      attempts: 0,
      nextAttemptAt: timestamp,
      lastError: null,
      createdAt: timestamp,
    }

    const firstPush = await gateway.push(insertOperation)
    const repeatedPush = await gateway.push(insertOperation)
    expect(firstPush.outcome).toBe('APPLIED')
    expect(repeatedPush.outcome).toBe('APPLIED')
    const storedRows = await userClient
      .from('workout_logs')
      .select('id')
      .eq('id', entityId)
    expect(storedRows.error).toBeNull()
    expect(storedRows.data).toHaveLength(1)

    const updatedPayload: RemoteRecord = {
      ...(firstPush.outcome === 'APPLIED' ? firstPush.record : insertedRecord),
      notes: 'paikallinen päivitys',
      version: 1,
    }
    const updateOperation: OutboxOperation = {
      ...insertOperation,
      operationId: randomUUID(),
      kind: 'UPDATE',
      baseVersion: 1,
      localVersion: 2,
      payload: updatedPayload,
    }
    const updated = await gateway.push(updateOperation)
    expect(updated.outcome).toBe('APPLIED')
    if (updated.outcome !== 'APPLIED') throw new Error('Päivitys ei onnistunut.')
    expect(updated.record.version).toBe(2)

    const external = await userClient
      .from('workout_logs')
      .update({ notes: 'toisen laitteen päivitys', version: 2 })
      .eq('id', entityId)
      .select()
      .single()
    expect(external.error).toBeNull()

    const staleOperation: OutboxOperation = {
      ...updateOperation,
      operationId: randomUUID(),
      baseVersion: 2,
      localVersion: 3,
      payload: { ...updated.record, notes: 'vanhentunut paikallinen muutos', version: 2 },
    }
    const conflict = await gateway.push(staleOperation)
    expect(conflict.outcome).toBe('CONFLICT')
    if (conflict.outcome !== 'CONFLICT') throw new Error('Konfliktia ei havaittu.')
    expect(conflict.remoteRecord.notes).toBe('toisen laitteen päivitys')

    const sharedTimestamp = '2026-08-24T11:00:00.000Z'
    const metricIds = [randomUUID(), randomUUID()].sort()
    const metrics = metricIds.map((id, index) => ({
      id,
      user_id: userId,
      measured_on: `2026-08-${String(20 + index).padStart(2, '0')}`,
      weight_kg: 60 + index,
      created_at: sharedTimestamp,
      updated_at: sharedTimestamp,
    }))
    const insertedMetrics = await userClient.from('body_metrics').insert(metrics)
    expect(insertedMetrics.error).toBeNull()

    const firstPage = await gateway.pull(userId, 'body_metrics', null, 1)
    expect(firstPage.records).toHaveLength(1)
    expect(firstPage.hasMore).toBe(true)
    const cursor = {
      updatedAt: firstPage.records[0].updated_at,
      id: firstPage.records[0].id,
    }
    const secondPage = await gateway.pull(userId, 'body_metrics', cursor, 1)
    expect(secondPage.records).toHaveLength(1)
    expect(
      new Set([...firstPage.records, ...secondPage.records].map((row) => row.id)),
    ).toEqual(new Set(metricIds))
  })
})
