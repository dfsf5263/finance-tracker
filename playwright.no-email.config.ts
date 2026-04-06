import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env') })

/**
 * Playwright config for testing flows when email is not configured.
 * Runs a separate dev server on port 3001 with RESEND_API_KEY unset.
 * Only tests tagged @no-email are included.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report-no-email' }], ['list']],

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'no-email-setup',
      testMatch: /setup\/auth\.setup\.ts/,
    },
    {
      name: 'no-email-household-setup',
      testMatch: /setup\/household\.setup\.ts/,
      dependencies: ['no-email-setup'],
      use: { storageState: 'tests/e2e/.auth/user.json' },
    },
    {
      name: 'no-email',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      grep: /@no-email/,
      dependencies: ['no-email-household-setup'],
    },
  ],

  webServer: {
    command: process.env.CI ? 'npm run build && npm run start -- -p 3001' : 'npm run dev -- -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL ?? '',
      APP_URL: 'http://localhost:3001',
      RESEND_API_KEY: '',
    },
  },
})
