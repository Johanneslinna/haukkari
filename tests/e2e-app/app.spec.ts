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
    returningStrengthDays?: number
    availableDayCount?: number
    minutesPerSession?: number
    experience?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
    equipmentPreset?: 'Ei välineitä' | 'Koti' | 'Kuntosali'
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
    await page
      .getByLabel(label, { exact: true })
      .setChecked(
        options.availableDayCount === undefined
          ? index + 1 === weekday
          : index < options.availableDayCount,
      )
  }
  if (options.experience) {
    await page.getByLabel('Voimaharjoittelukokemus').selectOption(options.experience)
  }
  if (options.minutesPerSession) {
    await page
      .getByLabel('Oletusaika uusille harjoituspäiville (min)')
      .fill(String(options.minutesPerSession))
    for (const label of labels.slice(0, options.availableDayCount ?? 0)) {
      await page
        .getByLabel(`${label}: enimmäisaika (min)`)
        .fill(String(options.minutesPerSession))
    }
  }
  if (options.strengthProgressionScenario || options.equipmentPreset) {
    await page
      .getByRole('button', {
        name: options.equipmentPreset ?? 'Koti',
        exact: true,
      })
      .click()
  }
  if (options.strengthProgressionScenario) {
    await page.getByLabel('Mieluisat harjoitukset').fill('Maljakyykky')
  }
  if (options.returningStrengthDays !== undefined) {
    await page
      .getByLabel('Olen harjoitellut voimaa aiemmin säännöllisesti vähintään 12 viikkoa.')
      .check()
    const lastDate = await page.evaluate(
      (days) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10),
      options.returningStrengthDays,
    )
    await page.getByLabel('Milloin teit viimeisen voimaharjoituksen?').fill(lastDate)
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

async function expectStrengthWeekRoles(page: Page, roles: string[]) {
  await page.goto('/viikko')
  const sessions = page.locator('.session-block')
  await expect(sessions).toHaveCount(roles.length)
  for (const [index, role] of roles.entries()) {
    await sessions.nth(index).click()
    await expect(page.getByRole('heading', { name: role, exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Takaisin viikkoon' }).click()
  }
}

async function planningRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<
        Array<{
          id: string
          table: string
          data: Record<string, unknown>
        }>
      >((resolve, reject) => {
        const request = indexedDB.open('treenikompassi')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('records', 'readonly')
          const records = transaction.objectStore('records').getAll()
          records.onerror = () => reject(records.error)
          records.onsuccess = () => {
            resolve(
              records.result
                .filter(
                  (record) =>
                    record.table === 'plan_versions' ||
                    record.table === 'training_plans' ||
                    record.table === 'workout_logs',
                )
                .map((record) => ({
                  id: record.id,
                  table: record.table,
                  data: record.data,
                })),
            )
            database.close()
          }
        }
      }),
  )
}

test('10 minuutin voimaviikko käyttää oikeaa A/B-kiertoa', async ({ page }) => {
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    availableDayCount: 2,
    minutesPerSession: 10,
    experience: 'INTERMEDIATE',
    returningStrengthDays: 1,
    equipmentPreset: 'Koti',
  })
  await expectStrengthWeekRoles(page, ['FULL BODY A', 'FULL BODY B'])
})

test('kolmen päivän voimaviikko näyttää koko kehon A/B/C-kierron', async ({ page }) => {
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    availableDayCount: 3,
    experience: 'INTERMEDIATE',
    returningStrengthDays: 1,
    equipmentPreset: 'Koti',
  })
  await expectStrengthWeekRoles(page, ['FULL BODY A', 'FULL BODY B', 'FULL BODY C'])
})

test('neljän päivän aktiivinen voimaviikko näyttää upper/lower-rakenteen', async ({
  page,
}) => {
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    availableDayCount: 4,
    experience: 'INTERMEDIATE',
    returningStrengthDays: 1,
    equipmentPreset: 'Koti',
  })
  await expectStrengthWeekRoles(page, ['UPPER A', 'LOWER A', 'UPPER B', 'LOWER B'])
  await page.locator('.session-block').nth(3).click()
  await expect(page.locator('.exercise-plan-list h3')).toHaveCount(3)
})

test('kolmen päivän 45 minuutin kuntosaliviikko on tuettu ja sisältää coren', async ({
  page,
}) => {
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    availableDayCount: 3,
    minutesPerSession: 45,
    experience: 'INTERMEDIATE',
    returningStrengthDays: 1,
    equipmentPreset: 'Kuntosali',
  })
  await page.goto('/viikko')
  await expect(page.getByText('Tuettu viikko')).toBeVisible()
  await expect(page.getByText('Vielä kattamatta:')).toHaveCount(0)
  const sessionLinks = page.locator('.session-block')
  let coreFound = false
  for (let index = 0; index < 3; index += 1) {
    await sessionLinks.nth(index).click()
    const category = await page.locator('.exercise-plan-list').textContent()
    coreFound ||= /dead bug|bird dog|pallof|keskivartalo/iu.test(category ?? '')
    await page.getByRole('link', { name: 'Takaisin viikkoon' }).click()
  }
  expect(coreFound).toBe(true)
})

test('yhden päivän voimaviikko näyttää osittaisen tilan ja toimintaohjeen', async ({
  page,
}) => {
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    availableDayCount: 1,
    minutesPerSession: 45,
    equipmentPreset: 'Koti',
  })
  await page.goto('/viikko')
  await expect(page.getByText('Osittainen viikko')).toBeVisible()
  await expect(
    page.getByText(/yhteen harjoituspäivään ei mahdu koko viikon tavoitealtistusta/iu),
  ).toBeVisible()
  await expect(page.getByText(/Lisää toinen harjoituspäivä/iu)).toBeVisible()
})

test('pelkkä kehonpaino näyttää vetoliikkeen välinerajan selkokielellä', async ({
  page,
}) => {
  await completeOnboarding(page, {
    availableDayCount: 2,
    equipmentPreset: 'Ei välineitä',
  })
  await page.goto('/viikko')
  await expect(page.getByText('Viikkoa ei voida muodostaa tuettuna')).toBeVisible()
  await expect(page.getByText('Vetävä liikesuunta tarvitsee välineen.')).toBeVisible()
  await expect(
    page.getByText(
      /Täysi kotivoimaohjelma tarvitsee vetoliikettä varten vähintään pitkän vastuskuminauhan/u,
    ),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Päivitä harjoitusvälineet' }).click()
  await expect(page).toHaveURL(/\/asetukset#harjoitusvalineet$/u)
  await expect(page.getByRole('heading', { name: 'Harjoitusvälineet' })).toBeVisible()
})

test('Helsingin sunnuntai–maanantai luo uuden viikon kerran ja säilyttää vanhan snapshotin', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-08-30T20:30:00.000Z') })
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    availableDayCount: 2,
    minutesPerSession: 45,
    equipmentPreset: 'Koti',
  })
  await expect(page.getByText('sunnuntai 30. elokuuta')).toBeVisible()
  const before = await planningRecords(page)
  const beforeVersions = before.filter((record) => record.table === 'plan_versions')
  const beforePlans = before.filter((record) => record.table === 'training_plans')
  const oldSnapshot = JSON.stringify(beforeVersions[0]?.data.snapshot)
  const oldVersionId = beforeVersions[0]?.id
  const workoutHistory = JSON.stringify(
    before.filter((record) => record.table === 'workout_logs'),
  )
  expect(beforePlans.filter((record) => record.data.status === 'ACTIVE')).toHaveLength(1)

  await page.clock.fastForward(60 * 60 * 1000)
  await page.reload()
  await expect(page.getByText('maanantai 31. elokuuta')).toBeVisible()
  await expect
    .poll(async () => {
      const records = await planningRecords(page)
      return records.filter((record) => record.table === 'plan_versions').length
    })
    .toBe(beforeVersions.length + 1)

  const after = await planningRecords(page)
  const afterVersions = after.filter((record) => record.table === 'plan_versions')
  const afterPlans = after.filter((record) => record.table === 'training_plans')
  const oldVersion = afterVersions.find((record) => record.id === oldVersionId)
  const newVersion = afterVersions.find((record) => record.id !== oldVersionId)
  expect(JSON.stringify(oldVersion?.data.snapshot)).toBe(oldSnapshot)
  expect(newVersion?.data.previous_plan_version_id).toBe(oldVersionId)
  expect(newVersion?.data.effective_from).toBe('2026-08-31')
  expect(newVersion?.data.change_reason).toBe('WEEKLY_MATERIALIZATION')
  expect(afterPlans.filter((record) => record.data.status === 'ACTIVE')).toHaveLength(1)
  expect(JSON.stringify(after.filter((record) => record.table === 'workout_logs'))).toBe(
    workoutHistory,
  )

  await page.reload()
  await expect
    .poll(async () => {
      const records = await planningRecords(page)
      return records.filter((record) => record.table === 'plan_versions').length
    })
    .toBe(beforeVersions.length + 1)
})

test('viikkonäkymän blueprint säilyy suoritukseen ja toteuma päivittää viikon uudelleenlatauksessa', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-08-24T08:00:00.000Z') })
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    availableDayCount: 4,
    experience: 'INTERMEDIATE',
    returningStrengthDays: 1,
    equipmentPreset: 'Koti',
    withStrengthSafetyContext: true,
  })
  const weekday = await page.evaluate(() => new Date().getDay() || 7)
  await page.goto('/viikko')
  await page
    .locator('.week-day')
    .nth(weekday - 1)
    .locator('.session-block')
    .click()
  await expect(page.locator('.exercise-plan-list h3').first()).toBeVisible()
  const previewExercises = await page.locator('.exercise-plan-list h3').allTextContents()
  expect(previewExercises.length).toBeGreaterThan(0)
  await page.getByRole('link', { name: /^(?:Nyt|Tänään)$/u }).click()
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await page.getByRole('button', { name: 'Ei mitään poikkeavaa' }).click()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
  await expect(page.locator('.exercise-plan-list h3')).toHaveText(previewExercises)
  await completeCompactStrengthWorkout(page, 10, 20)
  await page.goto('/viikko')
  await expect(page.getByText(/Toteutunut \d+(?:[.,]\d+)? · suunniteltu/u)).toBeVisible()
  const summary = await page
    .getByText(/Toteutunut \d+(?:[.,]\d+)? · suunniteltu/u)
    .textContent()
  await page.reload()
  await expect(page.getByText(summary!)).toBeVisible()
})

test('tauolta paluun päätös näkyy oikeassa käyttäjäpolussa ja säilyy latauksessa', async ({
  page,
}) => {
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    returningStrengthDays: 70,
    withStrengthSafetyContext: true,
  })
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await page.getByRole('button', { name: 'Ei mitään poikkeavaa' }).click()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
  await expect(
    page.getByRole('heading', { name: 'Palaat harjoitteluun tauon jälkeen.' }),
  ).toBeVisible()
  await expect(page.getByText(/Vahvistettu tauko: (?:69|70) päivää/u)).toBeVisible()
  await expect(page.getByText(/Hyväksyttyjä paluuharjoituksia: 0\/6/u)).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Palaat harjoitteluun tauon jälkeen.' }),
  ).toBeVisible()
  await expect(page.getByText(/Hyväksyttyjä paluuharjoituksia: 0\/6/u)).toBeVisible()
})

test('voimakas DOMS puolittaa voimaharjoituksen sarjat oikeassa käyttäjäpolussa', async ({
  page,
}) => {
  await completeOnboarding(page, {
    strengthProgressionScenario: true,
    returningStrengthDays: 1,
    experience: 'INTERMEDIATE',
    equipmentPreset: 'Koti',
    withStrengthSafetyContext: true,
  })
  const weekday = await page.evaluate(() => new Date().getDay() || 7)
  await page.goto('/viikko')
  await page
    .locator('.week-day')
    .nth(weekday - 1)
    .locator('.session-block')
    .click()
  const plannedDoses = page.locator('.exercise-plan-list .exercise-dose strong')
  await expect(plannedDoses.first()).toBeVisible()
  const plannedDoseLabels = await plannedDoses.allTextContents()
  const plannedSets = plannedDoseLabels.reduce(
    (sum, label) => sum + Number(label.match(/\d+/u)?.[0] ?? 0),
    0,
  )
  expect(plannedSets).toBeGreaterThan(0)

  await page.getByRole('link', { name: /^(?:Nyt|Tänään)$/u }).click()
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await page.getByRole('button', { name: 'Haluan kertoa tarkemmin' }).click()
  await page.getByLabel('Lihasarkuus').selectOption('HIGH')
  await page.getByLabel('Toivottu harjoitustyyppi').selectOption('STRENGTH')
  await page.getByRole('button', { name: 'Näytä päivän suositus' }).click()

  await expect(
    page.getByRole('heading', { name: 'Keltainen – kevennä määrää' }),
  ).toBeVisible()
  await expect(page.getByText(/50 % pienemmällä sarjamäärällä/u)).toBeVisible()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()

  const adaptedDoses = page.locator('.exercise-plan-list .exercise-dose strong')
  await expect(adaptedDoses.first()).toBeVisible()
  const adaptedDoseLabels = await adaptedDoses.allTextContents()
  const adaptedSets = adaptedDoseLabels.reduce(
    (sum, label) => sum + Number(label.match(/\d+/u)?.[0] ?? 0),
    0,
  )
  expect(adaptedSets).toBe(Math.ceil(plannedSets * 0.5))
  await expect(page.getByText(/lihasarkuus puolitti työsarjojen määrän/iu)).toBeVisible()

  await page.reload()
  const reloadedDoses = page.locator('.exercise-plan-list .exercise-dose strong')
  await expect(reloadedDoses.first()).toBeVisible()
  const reloadedDoseLabels = await reloadedDoses.allTextContents()
  const reloadedSets = reloadedDoseLabels.reduce(
    (sum, label) => sum + Number(label.match(/\d+/u)?.[0] ?? 0),
    0,
  )
  expect(reloadedSets).toBe(adaptedSets)

  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()
  await expect(page.locator('.active-exercise-card .load-guidance')).toContainText(
    /säilytä kuorma ja toistot; voimakkaan lihasarkuuden/iu,
  )
  await expect(page.getByText(`0/${adaptedSets} sarjaa/osiota kirjattu`)).toBeVisible()
  await page.reload()
  await expect(page.locator('.active-exercise-card .load-guidance')).toContainText(
    /säilytä kuorma ja toistot; voimakkaan lihasarkuuden/iu,
  )
  await expect(page.getByText(`0/${adaptedSets} sarjaa/osiota kirjattu`)).toBeVisible()
})

function repetitionsFromDose(value: string, useMaximum: boolean) {
  const numbers = [...value.matchAll(/\d+/gu)].map((match) => Number(match[0]))
  const maximum = numbers.at(-1)
  if (!maximum) throw new Error(`Toistoaluetta ei löytynyt annoksesta: ${value}`)
  return useMaximum ? maximum : Math.max(1, maximum - 1)
}

async function verifyProgressionSurvivesReload(
  page: Page,
  exerciseName: string,
  guidance: RegExp,
  expectedRepetitions: string,
  expectedLoad: string,
) {
  const openExercise = async () => {
    for (let index = 0; index < 10; index += 1) {
      if (
        await page
          .locator('.active-exercise-card h2')
          .filter({ hasText: exerciseName })
          .isVisible()
      ) {
        return
      }
      await page.getByRole('button', { name: 'Seuraava liike' }).click()
    }
    throw new Error(`Aktiivista liikettä ei löytynyt: ${exerciseName}`)
  }

  await openExercise()
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
  await openExercise()
  await expect(page.getByText(guidance)).toBeVisible()
  await expect(
    page.locator('.active-exercise-card .set-row').first().getByLabel('Toistot'),
  ).toHaveValue(expectedRepetitions)
  await expect(
    page
      .locator('.active-exercise-card .set-row')
      .first()
      .locator('label.compact-field')
      .filter({ hasText: 'Kuorma kg / käsipaino' })
      .locator('input'),
  ).toHaveValue(expectedLoad)
}

async function completeCompactStrengthWorkout(
  page: Page,
  targetRepetitions: number,
  targetLoadKg: number,
  options: {
    minutes?: 10 | 20 | 30
    exerciseName?: string
  } = {},
) {
  const exerciseNameTarget = options.exerciseName ?? 'Maljakyykky'
  await page
    .locator('.choice-card')
    .filter({ hasText: `${options.minutes ?? 10} min` })
    .getByRole('radio')
    .check()
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()

  for (;;) {
    const exerciseName = await page.locator('.active-exercise-card h2').textContent()
    const rows = page.locator('.active-exercise-card .set-row')
    for (let index = 0; index < (await rows.count()); index += 1) {
      const row = rows.nth(index)
      const repetitions = row.getByLabel('Toistot')
      if (await repetitions.count()) {
        await repetitions.fill(
          exerciseName === exerciseNameTarget ? String(targetRepetitions) : '8',
        )
      }
      const rir = row.getByLabel('RIR (toistoa varastossa)')
      if (await rir.count()) await rir.fill('3')
      if (exerciseName === exerciseNameTarget) {
        await row.getByLabel('Kuorma kg / käsipaino').fill(String(targetLoadKg))
      }
      await completeSetSafely(row)
    }
    const next = page.getByRole('button', { name: 'Seuraava liike' })
    if (!(await next.count())) break
    await next.click()
  }

  await page.getByRole('button', { name: 'Siirry palautteeseen' }).click()
  await expect(page.getByLabel('Toteuma')).toHaveValue('COMPLETED')
  await page.getByRole('button', { name: 'Tallenna harjoitus ja palaute' }).click()
  await expect(page).toHaveURL(/\/historia\/[0-9a-f-]+$/u, { timeout: 20_000 })
}

test('ydinpolku toimii pienillä mobiileilla ja työpöydällä', async ({
  page,
}, testInfo) => {
  await completeOnboarding(page)
  await expect(page.locator('.haukkari-beta-label:visible')).toHaveText('INTERNAL BETA')
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
  await completeOnboarding(page, {
    withStrengthSafetyContext: true,
    equipmentPreset: 'Koti',
  })
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
  await completeOnboarding(page, {
    withStrengthSafetyContext: true,
    equipmentPreset: 'Koti',
  })
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
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-08-24T08:00:00.000Z') })
  await completeOnboarding(page, {
    withStrengthSafetyContext: true,
    strengthProgressionScenario: true,
    availableDayCount: 2,
  })

  const openTodayWorkout = async () => {
    await page.goto('/')
    const start = page.getByRole('link', { name: 'Aloita treeni' })
    await expect(start).toBeVisible({ timeout: 15_000 })
    await start.click()
    if (/\/kuntotarkistus$/u.test(page.url())) {
      await page.getByRole('button', { name: 'Ei mitään poikkeavaa' }).click()
      await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
    }
  }
  const advanceToNextTrainingDay = async (days: number) => {
    await page.clock.fastForward(days * 86_400_000)
    await openTodayWorkout()
  }

  await openTodayWorkout()
  await expect(page.getByRole('heading', { name: 'Yhden käden soutu' })).toBeVisible()
  const firstDose = await page
    .locator('.exercise-plan-list li')
    .filter({ hasText: 'Yhden käden soutu' })
    .locator('.exercise-dose strong')
    .textContent()
  const maximumRepetitions = repetitionsFromDose(firstDose ?? '', true)
  await completeCompactStrengthWorkout(page, maximumRepetitions, 5, {
    minutes: 20,
    exerciseName: 'Yhden käden soutu',
  })
  await advanceToNextTrainingDay(1)
  await completeCompactStrengthWorkout(page, maximumRepetitions, 5, {
    minutes: 20,
    exerciseName: 'Yhden käden soutu',
  })

  await advanceToNextTrainingDay(6)
  await expect(
    page.getByText('Vahvista seuraava käytettävissä oleva kuorma'),
  ).toBeVisible()
  await expect(page.getByText('Nykyinen kuorma: 5 kg')).toBeVisible()
  const nextLoad = page.getByLabel('Seuraava kuorma liikkeelle Yhden käden soutu')
  await nextLoad.fill('6')
  await page.getByRole('button', { name: 'Vahvista kuorma' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Kuormaporras ylittää 10 %' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Seuraava askel: säilytä kuorma ja vahvista pienin/u),
  ).toBeVisible()

  await completeCompactStrengthWorkout(page, maximumRepetitions, 20, {
    minutes: 20,
    exerciseName: 'Yhden käden soutu',
  })
  await advanceToNextTrainingDay(1)
  await completeCompactStrengthWorkout(page, maximumRepetitions, 20, {
    minutes: 20,
    exerciseName: 'Yhden käden soutu',
  })

  await advanceToNextTrainingDay(6)
  await expect(
    page.getByText('Vahvista seuraava käytettävissä oleva kuorma'),
  ).toBeVisible()
  await expect(page.getByText('Nykyinen kuorma: 20 kg')).toBeVisible()
  const validNextLoad = page.getByLabel('Seuraava kuorma liikkeelle Yhden käden soutu')
  await validNextLoad.fill('21')
  await page.getByRole('button', { name: 'Vahvista kuorma' }).click()
  await expect(
    page.getByText(
      'Seuraava askel: nosta kuorma vahvistettuun seuraavaan portaaseen (21 kg).',
    ),
  ).toBeVisible()
  await expect(validNextLoad).toHaveCount(0)
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()
  await verifyProgressionSurvivesReload(
    page,
    'Yhden käden soutu',
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
  await completeOnboarding(page, {
    withStrengthSafetyContext: true,
    equipmentPreset: 'Koti',
  })
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
