import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const bucket = 'progress-photos'
const password = 'Haukkari-test-2026!'

function localSupabaseEnvironment() {
  const cli = path.resolve('node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cli, 'status', '-o', 'env'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  })

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Paikallisen Supabasen tilaa ei voitu lukea.')
  }

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

async function authenticatedClient(url, key, email) {
  const supabase = client(url, key)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `Kirjautuminen epäonnistui käyttäjälle ${email}.`)
  return supabase
}

async function run() {
  const environment = localSupabaseEnvironment()
  const apiUrl = environment.API_URL
  const publicKey = environment.ANON_KEY ?? environment.PUBLISHABLE_KEY
  const adminKey = environment.SERVICE_ROLE_KEY ?? environment.SECRET_KEY

  assert.ok(apiUrl, 'API_URL puuttuu Supabasen paikallisesta ympäristöstä.')
  assert.ok(publicKey, 'Julkinen Supabase-avain puuttuu paikallisesta ympäristöstä.')
  assert.ok(adminKey, 'Service role -avain puuttuu paikallisesta ympäristöstä.')

  const admin = client(apiUrl, adminKey)
  const runId = `${Date.now()}-${randomUUID()}`
  const emailA = `rls-a-${runId}@example.invalid`
  const emailB = `rls-b-${runId}@example.invalid`
  const createdUserIds = []
  let clientB
  let photoPath

  try {
    const userAResult = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    })
    assert.equal(userAResult.error, null, 'Käyttäjän A luonti epäonnistui.')
    assert.ok(userAResult.data.user)
    createdUserIds.push(userAResult.data.user.id)

    const userBResult = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    })
    assert.equal(userBResult.error, null, 'Käyttäjän B luonti epäonnistui.')
    assert.ok(userBResult.data.user)
    createdUserIds.push(userBResult.data.user.id)

    const [userAId, userBId] = createdUserIds
    const clientA = await authenticatedClient(apiUrl, publicKey, emailA)
    clientB = await authenticatedClient(apiUrl, publicKey, emailB)

    const profileA = await clientA.from('profiles').select('user_id')
    assert.equal(profileA.error, null)
    assert.deepEqual(profileA.data, [{ user_id: userAId }])

    const logAId = randomUUID()
    const logBId = randomUUID()
    const logA = await clientA.from('workout_logs').insert({
      id: logAId,
      user_id: userAId,
      performed_at: new Date().toISOString(),
      notes: 'käyttäjä A',
    })
    assert.equal(logA.error, null)

    const logB = await clientB.from('workout_logs').insert({
      id: logBId,
      user_id: userBId,
      performed_at: new Date().toISOString(),
      notes: 'käyttäjä B',
    })
    assert.equal(logB.error, null)

    const foreignRead = await clientA.from('workout_logs').select('id').eq('id', logBId)
    assert.equal(foreignRead.error, null)
    assert.deepEqual(foreignRead.data, [])

    const foreignUpdate = await clientA
      .from('workout_logs')
      .update({ notes: 'ei saa muuttua' })
      .eq('id', logBId)
      .select('id')
    assert.equal(foreignUpdate.error, null)
    assert.deepEqual(foreignUpdate.data, [])

    const foreignDelete = await clientA
      .from('workout_logs')
      .delete()
      .eq('id', logBId)
      .select('id')
    assert.equal(foreignDelete.error, null)
    assert.deepEqual(foreignDelete.data, [])

    const foreignInsert = await clientA.from('workout_logs').insert({
      user_id: userBId,
      performed_at: new Date().toISOString(),
    })
    assert.ok(foreignInsert.error, 'A pystyi luomaan tietueen käyttäjän B omistukseen.')

    const ownershipChange = await clientA
      .from('workout_logs')
      .update({ user_id: userBId })
      .eq('id', logAId)
    assert.ok(ownershipChange.error, 'A pystyi vaihtamaan oman tietueensa omistajuuden.')

    const preservedLog = await clientB
      .from('workout_logs')
      .select('notes')
      .eq('id', logBId)
      .single()
    assert.equal(preservedLog.error, null)
    assert.equal(preservedLog.data.notes, 'käyttäjä B')

    photoPath = `${userBId}/${randomUUID()}.png`
    const photo = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const uploadedPhoto = await clientB.storage.from(bucket).upload(photoPath, photo, {
      contentType: 'image/png',
      upsert: false,
    })
    assert.equal(uploadedPhoto.error, null)

    const ownPhoto = await clientB.storage.from(bucket).download(photoPath)
    assert.equal(ownPhoto.error, null)
    assert.ok(ownPhoto.data)

    const foreignPhoto = await clientA.storage.from(bucket).download(photoPath)
    assert.ok(foreignPhoto.error, 'A pystyi lataamaan käyttäjän B yksityisen kuvan.')

    const foreignSignedUrl = await clientA.storage
      .from(bucket)
      .createSignedUrl(photoPath, 60)
    assert.ok(
      foreignSignedUrl.error,
      'A pystyi allekirjoittamaan käyttäjän B kuvan URL:n.',
    )

    const publicUrl = clientB.storage.from(bucket).getPublicUrl(photoPath).data.publicUrl
    const publicResponse = await fetch(publicUrl)
    assert.equal(
      publicResponse.ok,
      false,
      'Yksityinen kuva aukesi ilman käyttäjäistuntoa.',
    )

    console.log('Paikallinen API-eristystesti: PASS')
    console.log(
      'Tarkistettu: Auth, SELECT, INSERT, UPDATE, DELETE, omistajuus ja Storage.',
    )
  } finally {
    if (clientB && photoPath) {
      await clientB.storage.from(bucket).remove([photoPath])
    }
    for (const userId of createdUserIds.reverse()) {
      await admin.auth.admin.deleteUser(userId)
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
