import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env') })

// Clear RESEND_API_KEY so test.skip(!!process.env.RESEND_API_KEY) evaluates to false
process.env.RESEND_API_KEY = ''

/**
 * Playwright config for testing sign-up without email verification.
 * Runs a separate dev server on port 3001 with RESEND_API_KEY unset.
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
      name: 'no-email',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: /auth\.spec\.ts/,
      grep: /sign up redirects to dashboard when email verification is disabled/i,
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
