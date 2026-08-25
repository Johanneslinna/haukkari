import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

function localSupabaseEnvironment() {
  const cli = path.resolve('node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cli, 'status', '-o', 'env'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) throw new Error(result.stderr.trim())
  return Object.fromEntries(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  )
}

function client(url, key) {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function run() {
  const environment = localSupabaseEnvironment()
  const apiUrl = environment.API_URL
  const publicKey = environment.ANON_KEY ?? environment.PUBLISHABLE_KEY
  const adminKey = environment.SERVICE_ROLE_KEY ?? environment.SECRET_KEY
  assert.ok(apiUrl && publicKey && adminKey, 'Paikallisen Supabasen avaimet puuttuvat.')

  const admin = client(apiUrl, adminKey)
  const email = `delete-${Date.now()}-${randomUUID()}@example.invalid`
  const password = 'Haukkari-delete-test-2026!'
  let userId = ''
  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    assert.equal(created.error, null)
    assert.ok(created.data.user)
    userId = created.data.user.id

    const user = client(apiUrl, publicKey)
    const signedIn = await user.auth.signInWithPassword({ email, password })
    assert.equal(signedIn.error, null)

    const log = await user.from('workout_logs').insert({
      user_id: userId,
      performed_at: new Date().toISOString(),
      notes: 'poistotestin historia',
    })
    assert.equal(log.error, null)
    const subscription = await user.from('push_subscriptions').insert({
      user_id: userId,
      device_key: 'delete-test-device',
      endpoint: `https://push.example.invalid/${randomUUID()}`,
      p256dh: 'test-p256dh',
      auth_key: 'test-auth',
    })
    assert.equal(subscription.error, null)
    const photoPath = `${userId}/${randomUUID()}.png`
    const uploaded = await user.storage
      .from('progress-photos')
      .upload(photoPath, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
        contentType: 'image/png',
      })
    assert.equal(uploaded.error, null)

    const deletedResponse = await fetch(`${apiUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${signedIn.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation: 'POISTA' }),
    })
    const deleted = await deletedResponse.json()
    assert.equal(deletedResponse.status, 200, JSON.stringify(deleted))
    assert.deepEqual(deleted, { deleted: true })

    const authResult = await admin.auth.admin.getUserById(userId)
    assert.ok(authResult.error || !authResult.data.user, 'Auth-käyttäjä jäi voimaan.')
    for (const table of ['profiles', 'workout_logs', 'push_subscriptions']) {
      const rows = await admin.from(table).select('id').eq('user_id', userId)
      assert.equal(rows.error, null)
      assert.equal(rows.data?.length, 0, `${table}: käyttäjän tietoja jäi tietokantaan.`)
    }
    const photos = await admin.storage.from('progress-photos').list(userId)
    assert.equal(photos.error, null)
    assert.equal(photos.data?.length, 0, 'Käyttäjän yksityinen kuva jäi Storageen.')
    userId = ''
    process.stdout.write('Tilin poistotesti: PASS (DB, Storage, Push, Auth)\n')
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId)
  }
}

run().catch((reason) => {
  process.stderr.write(`${reason instanceof Error ? reason.message : String(reason)}\n`)
  process.exitCode = 1
})
