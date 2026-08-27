import { expect, test, type Locator, type Page } from '@playwright/test'

async function completeSetSafely(setRow: Locator) {
  await setRow.getByLabel('Kipu sarjan aikana').selectOption('NONE')
  await setRow.getByLabel('Tekniikka').selectOption('OK')
  const completed = setRow.getByLabel('Valmis')
  await completed.check()
  await expect(completed).toBeChecked()
}

async function completeOnboarding(
  page: Page,
  options: {
    withStrengthSafetyContext?: boolean
    strengthProgressionScenario?: boolean
  } = {},
) {
  await page.goto('/')
  await expect(page).toHaveURL(/\/aloitus$/u)
  await page.getByLabel('Etunimi tai kutsumanimi').fill('Aino')
  if (options.strengthProgressionScenario) {
    await page
      .getByRole('radio', { name: 'Lihasmassan kasvattaminen', exact: true })
      .check()
  }
  await page.getByRole('button', { name: 'Jatka' }).click()
  const weekday = await page.evaluate(() => new Date().getDay() || 7)
  const labels = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']
  for (const [index, label] of labels.entries()) {
    await page.getByLabel(label, { exact: true }).setChecked(index + 1 === weekday)
  }
  if (options.strengthProgressionScenario) {
    await page.getByRole('button', { name: 'Koti', exact: true }).click()
    await page.getByLabel('Mieluisat harjoitukset').fill('Maljakyykky')
  }
  await page.getByRole('button', { name: 'Jatka' }).click()
  if (options.withStrengthSafetyContext) {
    await expect(
      page.getByRole('heading', { name: 'Harjoitteluun vaikuttavat tiedot' }),
    ).toBeVisible()
    await page
      .getByLabel('Lisätiedot ja ammattilaisen ohjeet (valinnainen)')
      .fill('Ei tiedossa olevia harjoitteluun vaikuttavia terveysrajoitteita.')
  }
  await page.getByRole('button', { name: 'Jatka' }).click()
  if (options.withStrengthSafetyContext) {
    await page.getByLabel(/Annan nimenomaisen suostumukseni/u).check()
  } else {
    await expect(page.getByText(/Et antanut vapaaehtoisia terveystietoja/u)).toBeVisible()
  }
  await page.getByRole('button', { name: 'Vahvista ja luo suunnitelma' }).click()
  await expect(page).toHaveURL(/\/$/u, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Aino/u })).toBeVisible()
}

function repetitionsFromDose(value: string, useMaximum: boolean) {
  const numbers = [...value.matchAll(/\d+/gu)].map((match) => Number(match[0]))
  const maximum = numbers.at(-1)
  if (!maximum) throw new Error(`Toistoaluetta ei löytynyt annoksesta: ${value}`)
  return useMaximum ? maximum : Math.max(1, maximum - 1)
}

async function verifyProgressionSurvivesReload(
  page: Page,
  guidance: RegExp,
  expectedRepetitions: string,
  expectedLoad: string,
) {
  await expect(page.getByText(guidance)).toBeVisible()
  const firstRow = page.locator('.active-exercise-card .set-row').first()
  await expect(firstRow.getByLabel('Toistot')).toHaveValue(expectedRepetitions)
  await expect(
    firstRow
      .locator('label.compact-field')
      .filter({ hasText: 'Kuorma kg / käsipaino' })
      .locator('input'),
  ).toHaveValue(expectedLoad)
  await page.reload()
  await expect(page.getByText(guidance)).toBeVisible()
  await expect(
    page.locator('.active-exercise-card .set-row').first().getByLabel('Toistot'),
  ).toHaveValue(expectedRepetitions)
}

async function seedStrengthHistory(
  page: Page,
  sessions: Array<{ workoutId: string; repetitions: number }>,
) {
  await page.evaluate(
    async ({ sessions }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('treenikompassi')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const transaction = database.transaction('records', 'readwrite')
      const store = transaction.objectStore('records')
      const records = await new Promise<Array<Record<string, unknown>>>(
        (resolve, reject) => {
          const request = store.getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        },
      )
      const replacedTables = new Set([
        'workouts',
        'workout_exercises',
        'workout_logs',
        'exercise_set_logs',
      ])
      for (const record of records) {
        if (replacedTables.has(String(record.table))) store.delete(String(record.key))
      }
      const userId = '44444444-4444-4444-8444-444444444444'
      for (const [index, session] of sessions.entries()) {
        const id = crypto.randomUUID()
        const performedAt = new Date(
          Date.now() - (sessions.length - index) * 86_400_000,
        ).toISOString()
        const data = {
          id,
          user_id: userId,
          created_at: performedAt,
          updated_at: performedAt,
          deleted_at: null,
          version: 1,
          workout_id: session.workoutId,
          performed_at: performedAt,
          duration_minutes: 35,
          rpe: 6,
          notes: null,
          completion_status: 'COMPLETED',
          feedback: {
            completionStatus: 'COMPLETED',
            sessionRpe: 6,
            difficulty: 'RIGHT',
            pain: 'NONE',
            painLocation: '',
            felt: 'SAME',
            notes: '',
            exerciseResults: [
              {
                exerciseCode: 'GOBLET_SQUAT',
                exerciseVersion: '1.0.0',
                exerciseName: 'Maljakyykky',
                loadType: 'DUMBBELL_KG_EACH',
                loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
                loadIncrementKg: 1,
                completedSets: 2,
                plannedSets: 2,
                completed: [true, true],
                repetitions: [session.repetitions, session.repetitions],
                loads: ['20', '20'],
                rirs: [3, 3],
                painResponses: ['NONE', 'NONE'],
                techniqueOk: [true, true],
                targetRepetitions: '8–12',
                targetRpe: 7,
                primaryMuscles: ['quadriceps', 'gluteals'],
                secondaryMuscles: ['trunk', 'upper back'],
              },
            ],
          },
          decision_trace: {},
        }
        store.put({
          key: `${userId}\u001fworkout_logs\u001f${id}`,
          entityKey: `workout_logs\u001f${id}`,
          id,
          userId,
          table: 'workout_logs',
          data,
          createdAt: performedAt,
          updatedAt: performedAt,
          deletedAt: null,
          version: 1,
          syncState: 'SYNCED',
        })
      }
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
      database.close()
    },
    { sessions },
  )
}

test('ydinpolku toimii pienillä mobiileilla ja työpöydällä', async ({
  page,
}, testInfo) => {
  await completeOnboarding(page)
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflows).toBe(false)

  if (testInfo.project.name === 'desktop-keyboard') {
    await expect(
      page.getByRole('navigation', { name: 'Päänavigaatio' }).first(),
    ).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Siirry sisältöön' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
  } else {
    await expect(page.getByRole('navigation', { name: 'Päänavigaatio' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Vko/u })).toBeVisible()
  }

  await page
    .getByRole('link', {
      name: testInfo.project.name === 'desktop-keyboard' ? 'Viikko' : 'Vko',
      exact: true,
    })
    .click()
  await expect(page.getByRole('heading', { name: 'Tämä viikko' })).toBeVisible()
  const plannedSession = page.locator('.session-block').first()
  await expect(plannedSession).toContainText('Katso ohjelma')
  await plannedSession.click()
  await expect(page).toHaveURL(/\/viikko\/.+/u)
  await expect(page.getByText('Tämä on ennakkonäkymä.')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Liikkeet, sarjat ja kuormitus' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aloita harjoitus' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Takaisin viikkoon' }).click()
  await expect(page).toHaveURL(/\/viikko$/u)
  await page.getByRole('link', { name: 'Lisää', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Lisää' })).toBeVisible()
})

test('käynnissä oleva harjoitus säilyy offline-latauksessa', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'android-small',
    'Offline-polku ajetaan Chromium-mobiililla.',
  )
  await completeOnboarding(page, { withStrengthSafetyContext: true })
  await page.getByRole('link', { name: 'Vko', exact: true }).click()
  const weekday = await page.evaluate(() => new Date().getDay() || 7)
  await expect(
    page
      .locator('.week-day')
      .nth(weekday - 1)
      .locator('.session-block')
      .first(),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Nyt', exact: true }).click()
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await expect(
    page.getByRole('heading', { name: 'Onko jokin tänään poikkeavaa?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Ei mitään poikkeavaa' }).click()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()
  await expect(page.getByText('Harjoitus käynnissä')).toBeVisible()
  const firstSetRow = page.locator('.active-exercise-card .set-row').first()
  await completeSetSafely(firstSetRow)
  await page.waitForTimeout(250)
  await expect(page).toHaveURL(/\/harjoitus$/u)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await expect(page).toHaveURL(/\/harjoitus$/u)
  await expect(page.getByText('Harjoitus käynnissä')).toBeVisible()
  await expect(page.getByLabel('Valmis').first()).toBeChecked()
  await context.setOffline(false)
})

test('kartoituksesta syntynyt harjoitus voidaan suorittaa ja avata palautteineen historiasta', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'android-small',
    'Koko aktiivisen harjoituksen polku ajetaan kerran Chromium-mobiililla.',
  )
  await completeOnboarding(page, { withStrengthSafetyContext: true })
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await expect(
    page.getByRole('heading', { name: 'Onko jokin tänään poikkeavaa?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Haluan kertoa tarkemmin' }).click()
  await expect(page.getByRole('heading', { name: 'Miltä tänään tuntuu?' })).toBeVisible()
  const minutes = page.getByLabel('Käytettävissä oleva aika (min)')
  await minutes.fill('')
  await expect(minutes).toHaveValue('')
  await minutes.fill('30')
  await page.getByRole('button', { name: 'Näytä päivän suositus' }).click()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
  await expect(page.getByText('Liikkeet, sarjat ja kuormitus')).toBeVisible()
  await expect(page.getByText(/RPE [0-9]+\/10/u).first()).toBeVisible()
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()

  for (;;) {
    const visibleSetRows = page.locator('.active-exercise-card .set-row')
    const visibleSetChecks = page.locator('.active-exercise-card').getByLabel('Valmis')
    for (let index = 0; index < (await visibleSetRows.count()); index += 1) {
      await completeSetSafely(visibleSetRows.nth(index))
    }
    await expect
      .poll(() =>
        visibleSetChecks.evaluateAll((items) =>
          items.every((item) => (item as HTMLInputElement).checked),
        ),
      )
      .toBe(true)
    const positionLabel = page.locator('.active-exercise-progress span').first()
    await expect(positionLabel).toBeVisible()
    const position = (await positionLabel.textContent())?.match(/(\d+)\/(\d+)/u)
    expect(position).not.toBeNull()
    const currentExercise = Number(position?.[1])
    const exerciseCount = Number(position?.[2])
    if (currentExercise === exerciseCount) break
    const next = page.getByRole('button', { name: 'Seuraava liike' })
    await expect(next).toBeVisible()
    await next.click()
    await expect(positionLabel).toHaveText(
      `Liike ${currentExercise + 1}/${exerciseCount}`,
    )
  }

  await page.getByRole('button', { name: 'Siirry palautteeseen' }).click()
  await expect(page.getByText(/Arvioi koko harjoitusta lämmittelyineen/u)).toBeVisible()
  await page.getByLabel('Muistiinpanot').fill('Liikkeet tuntuivat hallituilta.')
  await page.getByRole('button', { name: 'Tallenna harjoitus ja palaute' }).click()

  await expect(page).toHaveURL(/\/historia\/[0-9a-f-]+$/u)
  await expect(
    page.getByRole('heading', { name: 'Liikkeet ja työosuudet' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Miltä harjoitus tuntui?' }),
  ).toBeVisible()
  await expect(page.getByText('Liikkeet tuntuivat hallituilta.')).toBeVisible()
  await expect(page.getByText('Vaikutus seuraavaan harjoitukseen')).toBeVisible()
})

test('tallennetut voimaharjoituskerrat ohjaavat seuraavan käyttäjänäkymän progressiota', async ({
  page,
}) => {
  await completeOnboarding(page, {
    withStrengthSafetyContext: true,
    strengthProgressionScenario: true,
  })
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await page.getByRole('button', { name: 'Ei mitään poikkeavaa' }).click()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
  await expect(page.getByRole('heading', { name: 'Maljakyykky' })).toBeVisible()
  const firstDose = await page
    .locator('.exercise-plan-list li')
    .filter({ hasText: 'Maljakyykky' })
    .locator('.exercise-dose strong')
    .textContent()
  const maximumRepetitions = repetitionsFromDose(firstDose ?? '', true)
  await seedStrengthHistory(page, [
    {
      workoutId: '55555555-5555-4555-8555-555555555551',
      repetitions: maximumRepetitions - 1,
    },
  ])
  await page.reload()
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()
  const repetitionsGuidance =
    /Seuraava askel: lisää yksi toisto \(\d+\) ja säilytä sama kuorma\./u
  await verifyProgressionSurvivesReload(
    page,
    repetitionsGuidance,
    String(maximumRepetitions),
    '20',
  )

  await seedStrengthHistory(page, [
    {
      workoutId: '55555555-5555-4555-8555-555555555552',
      repetitions: maximumRepetitions,
    },
    {
      workoutId: '55555555-5555-4555-8555-555555555553',
      repetitions: maximumRepetitions,
    },
  ])
  await page.reload()
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()
  await verifyProgressionSurvivesReload(
    page,
    /Seuraava askel: nosta kuorma vahvistettuun seuraavaan portaaseen \(21 kg\)\./u,
    String(maximumRepetitions),
    '21',
  )
})

test('voimakas kipu keskeyttää harjoituksen ja estää progression', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'android-small',
    'Oirepolku ajetaan kerran Chromium-mobiililla.',
  )
  await completeOnboarding(page, { withStrengthSafetyContext: true })
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await page.getByRole('button', { name: 'Ei mitään poikkeavaa' }).click()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()
  await page.getByRole('button', { name: 'Keskeytä harjoitus' }).click()
  await page
    .getByRole('button', { name: 'Voimakas tai terävä kipu', exact: true })
    .click()

  await expect(
    page.getByRole('heading', { name: 'Miten harjoitus toteutui?' }),
  ).toBeVisible()
  await expect(page.getByLabel('Toteuma')).toHaveValue('STOPPED')
  await page.getByLabel('Kipu harjoituksen aikana').selectOption('SEVERE')
  await page.getByLabel('Kivun sijainti (valinnainen)').fill('Polvi')
  await page.getByRole('button', { name: 'Tallenna harjoitus ja palaute' }).click()

  await expect(
    page.getByRole('heading', { name: 'Harjoittelua ei jatketa vielä' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Voimakas kipupalaute estää kuorman nostamisen.*arvioon/u),
  ).toBeVisible()
})

test('tietosuojaviennit, mittauksen poisto ja ICS toimivat selaimessa', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'android-small',
    'Tietosuojan latauspolku ajetaan kerran Chromium-mobiililla.',
  )
  await completeOnboarding(page)

  await page.goto('/edistyminen')
  await page.getByLabel('Paino (kg)').fill('67.4')
  await page.getByRole('button', { name: 'Tallenna mittaus' }).click()
  await expect(page.getByRole('listitem').getByText('67,4 kg')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Poista', exact: true }).click()
  await expect(page.getByText('Mittaus poistettiin.')).toBeVisible()

  await page.goto('/muistutukset')
  await page.getByRole('button', { name: 'Tallenna muistutus' }).click()
  await expect(page.getByText('Muistutus tallennettiin.')).toBeVisible()
  const icsDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lataa .ics' }).click()
  const ics = await icsDownload
  expect(ics.suggestedFilename()).toMatch(/\.ics$/u)

  await page.goto('/tiedot')
  const jsonDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lataa kaikki JSON-muodossa' }).click()
  const json = await jsonDownload
  const jsonPath = await json.path()
  expect(jsonPath).not.toBeNull()
  const exported = JSON.parse(
    await import('node:fs/promises').then((fs) => fs.readFile(jsonPath!, 'utf8')),
  )
  expect(exported.format).toBe('haukkari-data-export')
  expect(
    exported.tables.find((table: { table: string }) => table.table === 'goal_profiles')
      .records.length,
  ).toBeGreaterThan(0)
  expect(
    exported.tables.find((table: { table: string }) => table.table === 'plan_versions')
      .records.length,
  ).toBeGreaterThan(0)

  const csvDownload = page.waitForEvent('download')
  await page
    .locator('.settings-row')
    .filter({ hasText: 'Tavoitteet' })
    .getByRole('button', { name: 'Lataa CSV' })
    .click()
  expect((await csvDownload).suggestedFilename()).toMatch(/goal_profiles.*\.csv$/u)
  await expect(page.getByRole('button', { name: /Web Push/u })).toHaveCount(0)
})
