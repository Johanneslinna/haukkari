import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const pushFiles = ['public/push-handler.js', 'supabase/functions/send-reminders/index.ts']
const forbiddenVisibleData = [
  'weight_kg',
  'waist_cm',
  'health_notes',
  'menstrualCycle',
  'sleepHours',
  'energy_kcal',
  'painLocation',
]

for (const file of pushFiles) {
  const source = await readFile(file, 'utf8')
  for (const term of forbiddenVisibleData) {
    assert.equal(
      source.includes(term),
      false,
      `${file} sisältää pushissa kielletyn kentän ${term}.`,
    )
  }
  assert.equal(
    /console\.(?:log|info|debug|error)/u.test(source),
    false,
    `${file} kirjoittaa lokiin.`,
  )
}

const handler = await readFile('public/push-handler.js', 'utf8')
assert.equal(
  handler.includes('event.data'),
  false,
  'Service worker lukee palvelimen vapaamuotoista push-dataa.',
)
assert.ok(handler.includes('Päivän treenitarkistus odottaa.'))

const deletion = await readFile('supabase/functions/delete-account/index.ts', 'utf8')
const databaseIndex = deletion.indexOf('const ownedTables')
const photoIndex = deletion.indexOf(".from('progress-photos')")
const pushIndex = deletion.indexOf(".from('push_subscriptions')")
const authIndex = deletion.indexOf('admin.auth.admin.deleteUser')
assert.ok(databaseIndex >= 0 && databaseIndex < photoIndex)
assert.ok(photoIndex < pushIndex && pushIndex < authIndex)

process.stdout.write('Vaiheen 5 tietosuojaskannaus: PASS\n')
