import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = path.resolve('docs/ui-validation/haukkari-today')

test('Tänään-näkymän responsiiviset koot ja keskeiset tilat', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-keyboard',
    'Visuaaliset kuvat tuotetaan kerran Chromiumilla.',
  )
  await page.clock.install({ time: new Date('2026-08-27T08:00:00.000Z') })
  await mkdir(outputDirectory, { recursive: true })
  await page.addInitScript(() => {
    localStorage.setItem('treenikompassi.theme', 'LIGHT')
  })

  const viewports = [
    { name: 'iphone-se', width: 375, height: 667 },
    { name: 'iphone', width: 390, height: 844 },
    { name: 'android', width: 412, height: 915 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 1000 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/?today-state=normal')
    await expect(page.getByRole('heading', { name: 'Koko kehon voima' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Aloita treeni' })).toBeVisible()
    if (viewport.width < 1024) {
      await expect(page.locator('.today-sync-badge')).toContainText('Tiedot turvassa')
      await expect(page.locator('.today-sync-badge')).toBeVisible()
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    if (viewport.width === 375 && viewport.height === 667) {
      const action = await page.getByRole('link', { name: 'Aloita treeni' }).boundingBox()
      expect(action).not.toBeNull()
      expect(action!.y + action!.height).toBeLessThanOrEqual(viewport.height)
    }
    await page.screenshot({
      path: path.join(
        outputDirectory,
        `normal-${viewport.name}-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    })
  }

  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/?today-state=normal')
  await expect(page.locator('.today-hero')).toBeVisible()
  const compactHero = await page.locator('.today-hero').boundingBox()
  expect(compactHero).not.toBeNull()
  const compactActions = page.locator('.today-hero-actions .button')
  expect(await compactActions.count()).toBe(2)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false)
  for (let index = 0; index < (await compactActions.count()); index += 1) {
    const action = await compactActions.nth(index).boundingBox()
    expect(action).not.toBeNull()
    if (!action || !compactHero) continue
    expect(action.height).toBeGreaterThanOrEqual(44)
    expect(action.x).toBeGreaterThanOrEqual(compactHero.x)
    expect(action.x + action.width).toBeLessThanOrEqual(compactHero.x + compactHero.width)
    expect(action.y + action.height).toBeLessThanOrEqual(
      compactHero.y + compactHero.height,
    )
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?today-state=normal')
  await page
    .getByRole('button', {
      name: 'Teema: vaalea. Vaihda seuraavaan tilaan.',
    })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('link', { name: 'Aloita treeni' })).toBeVisible()
  await page.evaluate(() => localStorage.setItem('treenikompassi.theme', 'LIGHT'))

  const states = [
    { query: 'recovery', file: 'state-recovery-mobile.png' },
    { query: 'red-stop', file: 'state-red-stop-mobile.png' },
    { query: 'offline', file: 'state-offline-mobile.png' },
    { query: 'sync-error', file: 'state-sync-error-mobile.png' },
    { query: 'loading', file: 'state-loading-mobile.png' },
    { query: 'complete', file: 'state-complete-mobile.png' },
  ]

  for (const state of states) {
    await page.goto(`/?today-state=${state.query}`)
    await expect(page.locator('.today-page')).toBeVisible()
    if (state.query === 'red-stop') {
      await expect(page.getByText('Harjoittelua ei suositella')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Aloita treeni' })).toHaveCount(0)
    }
    if (state.query === 'loading') {
      await expect(page.getByText('Ladataan päivän harjoitusta')).toBeAttached()
    }
    await page.screenshot({
      path: path.join(outputDirectory, state.file),
      fullPage: true,
    })
  }

  await page.goto('/?today-state=light')
  await expect(page.getByText('Kevyempi päivä')).toBeVisible()
  await expect(page.getByText('28 min')).toBeVisible()
  await page.goto('/?today-state=empty')
  await expect(page.getByText('Suunnitelma puuttuu')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Aloita treeni' })).toHaveCount(0)
})
