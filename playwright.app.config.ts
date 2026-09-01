import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-app',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-app' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    timezoneId: 'Europe/Helsinki',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'android-small', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-small', use: { ...devices['iPhone 13 Mini'] } },
    { name: 'desktop-keyboard', use: { ...devices['Desktop Chrome'] } },
  ],
})
