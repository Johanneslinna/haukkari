import { expect, test } from '@playwright/test'

test('kirjautumispolku on käytettävissä ilman konfiguroitua pilvipalvelua', async ({
  page,
}) => {
  await page.goto('/kirjaudu')
  await expect(page.getByRole('heading', { name: 'Kirjaudu' })).toBeVisible()
  await expect(page.getByLabel('Sähköposti')).toBeVisible()
  await expect(page.getByLabel('Salasana')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kirjaudu' })).toBeVisible()
})

test('rekisteröityminen kertoo sähköpostivahvistuksesta', async ({ page }) => {
  await page.goto('/rekisteroidy')
  await expect(page.getByRole('heading', { name: 'Luo tili' })).toBeVisible()
  await expect(
    page.getByText('Ensimmäinen kirjautuminen vaatii verkkoyhteyden.'),
  ).toBeVisible()
})
