import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const cronSecret = process.env.PHASE5_CRON_TEST_SECRET ?? 'local-phase5-cron-test-secret'

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

async function run() {
  const environment = localSupabaseEnvironment()
  const apiUrl = environment.API_URL
  const adminKey = environment.SERVICE_ROLE_KEY ?? environment.SECRET_KEY
  assert.ok(apiUrl && adminKey)
  const admin = createClient(apiUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let userId = ''
  try {
    const created = await admin.auth.admin.createUser({
      email: `push-expiry-${Date.now()}-${randomUUID()}@example.invalid`,
      email_confirm: true,
    })
    assert.equal(created.error, null)
    assert.ok(created.data.user)
    userId = created.data.user.id
    const subscriptionId = randomUUID()
    const inserted = await admin.from('push_subscriptions').insert({
      id: subscriptionId,
      user_id: userId,
      device_key: 'expiry-test-device',
      endpoint: `https://push.example.invalid/${randomUUID()}`,
      p256dh: 'expired-p256dh',
      auth_key: 'expired-auth',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    assert.equal(inserted.error, null)

    const unauthorized = await fetch(`${apiUrl}/functions/v1/send-reminders`, {
      method: 'POST',
    })
    assert.equal(unauthorized.status, 401)
    const response = await fetch(`${apiUrl}/functions/v1/send-reminders`, {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    })
    const result = await response.json()
    assert.equal(response.status, 200, JSON.stringify(result))
    assert.ok(result.removed >= 1)
    const expired = await admin
      .from('push_subscriptions')
      .select('deleted_at')
      .eq('id', subscriptionId)
      .single()
    assert.equal(expired.error, null)
    assert.ok(expired.data.deleted_at, 'Vanhentunut push-tilaus ei saanut tombstonea.')
    process.stdout.write('Muistutusten palvelintesti: PASS (auth-raja ja expiry)\n')
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId)
  }
}

run().catch((reason) => {
  process.stderr.write(`${reason instanceof Error ? reason.message : String(reason)}\n`)
  process.exitCode = 1
})
