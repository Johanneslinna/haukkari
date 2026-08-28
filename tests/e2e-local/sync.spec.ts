import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

const apiUrl = process.env.LOCAL_SUPABASE_API_URL ?? ''
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? ''
const adminKey = process.env.LOCAL_SUPABASE_ADMIN_KEY ?? ''
const password = 'Haukkari-e2e-2026!'
const email = `sync-e2e-${Date.now()}-${randomUUID()}@example.invalid`
const admin = createClient(apiUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const userClient = createClient(apiUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let userId = ''
const goalProfileId = randomUUID()
const goalPeriodId = randomUUID()
let weeklyPlanVersionId = ''
let weeklyTrainingPlanId = ''

async function signIn(page: Page) {
  await page.goto('/kirjaudu')
  await page.getByLabel('Sähköposti').fill(email)
  await page.getByLabel('Salasana').fill(password)
  await page.getByRole('button', { name: 'Kirjaudu' }).click()
  await expect(page.getByRole('heading', { name: /Synkronointitesti/u })).toBeVisible({
    timeout: 20_000,
  })
  await page.goto('/synkronointi')
  await expect(page.getByRole('heading', { name: 'Synkronoitu' })).toBeVisible({
    timeout: 20_000,
  })
  await page.waitForFunction(() => Boolean(window.__treenikompassiSyncTest))
}

test.beforeAll(async () => {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? 'E2E-testikäyttäjää ei voitu luoda.')
  }
  userId = created.data.user.id
  const prepared = await admin
    .from('profiles')
    .update({ display_name: 'Synkronointitesti', onboarding_completed: true })
    .eq('user_id', userId)
  if (prepared.error) throw new Error(prepared.error.message)
  const signedIn = await userClient.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw new Error(signedIn.error.message)
  const goalProfile = await userClient.from('goal_profiles').insert({
    id: goalProfileId,
    user_id: userId,
    primary_goal: 'MAX_STRENGTH',
  })
  if (goalProfile.error) throw new Error(goalProfile.error.message)
  const goalPeriod = await userClient.from('goal_periods').insert({
    id: goalPeriodId,
    user_id: userId,
    goal_profile_id: goalProfileId,
    starts_on: '2026-08-24',
    status: 'ACTIVE',
  })
  if (goalPeriod.error) throw new Error(goalPeriod.error.message)
})

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId)
})

test('offline-uudelleenkäynnistys, kaksi selainkontekstia, konflikti ja tombstone', async ({
  browser,
}) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  try {
    await signIn(pageA)
    await signIn(pageB)
    await contextA.setOffline(true)
    await contextB.setOffline(true)
    const weeklyInput = {
      goalPeriodId,
      weekAnchorDate: '2026-08-24',
    }
    const deviceAIds = await pageA.evaluate(
      ({ id, input }) =>
        window.__treenikompassiSyncTest!.createWeeklyMaterialization(id, input),
      { id: userId, input: { ...weeklyInput, writer: 'device-a' } },
    )
    const deviceBIds = await pageB.evaluate(
      ({ id, input }) =>
        window.__treenikompassiSyncTest!.createWeeklyMaterialization(id, input),
      { id: userId, input: { ...weeklyInput, writer: 'device-b' } },
    )
    expect(deviceBIds).toEqual(deviceAIds)
    weeklyPlanVersionId = deviceAIds.planVersionId
    weeklyTrainingPlanId = deviceAIds.trainingPlanId
    await Promise.all([contextA.setOffline(false), contextB.setOffline(false)])
    await Promise.all([
      pageA.getByRole('button', { name: 'Synkronoi nyt' }).click(),
      pageB.getByRole('button', { name: 'Synkronoi nyt' }).click(),
    ])
    await Promise.all([
      expect(pageA.getByRole('heading', { name: 'Synkronoitu' })).toBeVisible(),
      expect(pageB.getByRole('heading', { name: 'Synkronoitu' })).toBeVisible(),
    ])
    await expect(pageB.getByRole('link', { name: /Ratkaise ristiriidat/u })).toHaveCount(
      0,
    )
    const remoteVersions = await userClient
      .from('plan_versions')
      .select('id')
      .eq('goal_period_id', goalPeriodId)
      .eq('change_reason', 'WEEKLY_MATERIALIZATION')
    expect(remoteVersions.error).toBeNull()
    expect(remoteVersions.data).toEqual([{ id: weeklyPlanVersionId }])
    const remotePlans = await userClient
      .from('training_plans')
      .select('id,status,plan')
      .eq('plan_version_id', weeklyPlanVersionId)
    expect(remotePlans.error).toBeNull()
    expect(remotePlans.data).toHaveLength(1)
    expect(remotePlans.data?.[0]).toMatchObject({
      id: weeklyTrainingPlanId,
      status: 'ACTIVE',
    })
    const canonicalWriter = remotePlans.data?.[0]?.plan.writer
    expect(['device-a', 'device-b']).toContain(canonicalWriter)
    for (const page of [pageA, pageB]) {
      await expect
        .poll(() =>
          page.evaluate(
            ({ id, versionId, planId }) =>
              window.__treenikompassiSyncTest!.getWeeklyMaterialization(
                id,
                versionId,
                planId,
              ),
            { id: userId, versionId: weeklyPlanVersionId, planId: weeklyTrainingPlanId },
          ),
        )
        .toMatchObject({
          version: { id: weeklyPlanVersionId },
          plan: {
            id: weeklyTrainingPlanId,
            data: { status: 'ACTIVE', plan: { writer: canonicalWriter } },
          },
        })
    }

    await pageA.evaluate(() => navigator.serviceWorker.ready)
    await pageA.goto('/')
    await pageA.reload()
    await expect(pageA.getByRole('heading', { name: /Synkronointitesti/u })).toBeVisible()
    await pageA.waitForFunction(() => Boolean(window.__treenikompassiSyncTest))

    await contextA.setOffline(true)
    const workoutId = await pageA.evaluate(
      ({ id, notes }) => window.__treenikompassiSyncTest!.createWorkout(id, notes),
      { id: userId, notes: 'Offline-selaimen merkintä' },
    )
    expect(
      await pageA.evaluate(
        (id) => window.__treenikompassiSyncTest!.outboxCount(id),
        userId,
      ),
    ).toBe(1)

    await pageA.reload()
    await expect(pageA.getByRole('heading', { name: /Synkronointitesti/u })).toBeVisible()
    await pageA.waitForFunction(() => Boolean(window.__treenikompassiSyncTest))
    const persisted = await pageA.evaluate(
      ({ userId: id, workoutId: recordId }) =>
        window.__treenikompassiSyncTest!.getWorkout(id, recordId),
      { userId, workoutId },
    )
    expect(persisted).toMatchObject({ data: { notes: 'Offline-selaimen merkintä' } })

    await contextA.setOffline(false)
    await pageA.goto('/synkronointi')
    await pageA.getByRole('button', { name: 'Synkronoi nyt' }).click()
    await expect(pageA.getByRole('heading', { name: 'Synkronoitu' })).toBeVisible()
    await pageB.getByRole('button', { name: 'Synkronoi nyt' }).click()
    await expect
      .poll(() =>
        pageB.evaluate(
          ({ userId: id, workoutId: recordId }) =>
            window.__treenikompassiSyncTest!.getWorkout(id, recordId),
          { userId, workoutId },
        ),
      )
      .toMatchObject({ data: { notes: 'Offline-selaimen merkintä' } })

    await contextA.setOffline(true)
    await contextB.setOffline(true)
    await pageA.evaluate(
      ({ userId: id, workoutId: recordId }) =>
        window.__treenikompassiSyncTest!.updateWorkout(id, recordId, 'Laitteen A muutos'),
      { userId, workoutId },
    )
    await pageB.evaluate(
      ({ userId: id, workoutId: recordId }) =>
        window.__treenikompassiSyncTest!.updateWorkout(id, recordId, 'Laitteen B muutos'),
      { userId, workoutId },
    )

    await contextA.setOffline(false)
    await pageA.getByRole('button', { name: 'Synkronoi nyt' }).click()
    await expect(pageA.getByRole('heading', { name: 'Synkronoitu' })).toBeVisible()
    await contextB.setOffline(false)
    await pageB.getByRole('button', { name: 'Synkronoi nyt' }).click()
    await expect(pageB.getByRole('link', { name: /Ratkaise ristiriidat/u })).toBeVisible()
    await pageB.getByRole('link', { name: /Ratkaise ristiriidat/u }).click()
    await expect(pageB.locator('.conflict-columns pre').nth(0)).toContainText(
      'Laitteen B muutos',
    )
    await expect(pageB.locator('.conflict-columns pre').nth(1)).toContainText(
      'Laitteen A muutos',
    )
    await pageB.getByRole('button', { name: 'Säilytä tämän laitteen versio' }).click()
    await expect(pageB.getByText('Avoimia ristiriitoja ei ole.')).toBeVisible()
    await expect(pageB.getByRole('heading', { name: 'Synkronoitu' })).toBeVisible()
    await expect
      .poll(async () => {
        const result = await userClient
          .from('workout_logs')
          .select('notes, version')
          .eq('id', workoutId)
        return { data: result.data, error: result.error?.message ?? null }
      })
      .toMatchObject({
        data: [{ notes: 'Laitteen B muutos', version: 3 }],
        error: null,
      })

    await pageA.getByRole('button', { name: 'Synkronoi nyt' }).click()
    await expect
      .poll(() =>
        pageA.evaluate(
          ({ userId: id, workoutId: recordId }) =>
            window.__treenikompassiSyncTest!.getWorkout(id, recordId),
          { userId, workoutId },
        ),
      )
      .toMatchObject({ data: { notes: 'Laitteen B muutos' } })

    await pageA.evaluate(
      ({ userId: id, workoutId: recordId }) =>
        window.__treenikompassiSyncTest!.deleteWorkout(id, recordId),
      { userId, workoutId },
    )
    await pageA.getByRole('button', { name: 'Synkronoi nyt' }).click()
    await pageB.goto('/synkronointi')
    await pageB.getByRole('button', { name: 'Synkronoi nyt' }).click()
    await expect
      .poll(() =>
        pageB.evaluate(
          ({ userId: id, workoutId: recordId }) =>
            window.__treenikompassiSyncTest!.getWorkout(id, recordId),
          { userId, workoutId },
        ),
      )
      .toMatchObject({ deletedAt: expect.any(String) })
  } finally {
    await contextA.close()
    await contextB.close()
  }
})
