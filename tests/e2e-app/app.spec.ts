import { expect, test, type Page } from '@playwright/test'

async function completeOnboarding(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(/\/aloitus$/u)
  await page.getByLabel('Etunimi tai kutsumanimi').fill('Aino')
  await page.getByRole('button', { name: 'Jatka' }).click()
  const weekday = await page.evaluate(() => new Date().getDay() || 7)
  const labels = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']
  for (const [index, label] of labels.entries()) {
    await page.getByLabel(label, { exact: true }).setChecked(index + 1 === weekday)
  }
  await page.getByRole('button', { name: 'Jatka' }).click()
  await page.getByRole('button', { name: 'Jatka' }).click()
  await expect(page.getByText(/Et antanut vapaaehtoisia terveystietoja/u)).toBeVisible()
  await page.getByRole('button', { name: 'Vahvista ja luo suunnitelma' }).click()
  await expect(page).toHaveURL(/\/$/u, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Aino/u })).toBeVisible()
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
  await completeOnboarding(page)
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
  const firstCompletedSet = page.getByLabel('Valmis').first()
  await firstCompletedSet.check()
  await expect(firstCompletedSet).toBeChecked()
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
  await completeOnboarding(page)
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
    const visibleSetChecks = page.locator('.active-exercise-card').getByLabel('Valmis')
    for (let index = 0; index < (await visibleSetChecks.count()); index += 1) {
      await visibleSetChecks.nth(index).check()
      await expect(visibleSetChecks.nth(index)).toBeChecked()
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

test('voimakas kipu keskeyttää harjoituksen ja estää progression', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'android-small',
    'Oirepolku ajetaan kerran Chromium-mobiililla.',
  )
  await completeOnboarding(page)
  await page.getByRole('link', { name: 'Aloita treeni' }).click()
  await page.getByRole('button', { name: 'Ei mitään poikkeavaa' }).click()
  await page.getByRole('link', { name: 'Avaa päivän harjoitus' }).click()
  await page.getByRole('button', { name: 'Aloita harjoitus' }).click()
  await page.getByRole('button', { name: 'Keskeytä harjoitus' }).click()
  await page.getByRole('button', { name: 'Kipu', exact: true }).click()

  await expect(
    page.getByRole('heading', { name: 'Miten harjoitus toteutui?' }),
  ).toBeVisible()
  await expect(page.getByLabel('Toteuma')).toHaveValue('STOPPED')
  await page.getByLabel('Kipu harjoituksen aikana').selectOption('SEVERE')
  await page.getByLabel('Kivun sijainti (valinnainen)').fill('Polvi')
  await page.getByRole('button', { name: 'Tallenna harjoitus ja palaute' }).click()

  await expect(
    page.getByRole('heading', { name: 'Kova harjoittelu odottaa arviota' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Kirjasit voimakasta kipua.*oire pitää arvioida/u),
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
