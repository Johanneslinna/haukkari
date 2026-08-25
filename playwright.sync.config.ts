import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-local',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-sync' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
})
