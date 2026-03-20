import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load .env file — Playwright's recommended approach for test env vars
dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Auth setup — no storageState dependency, runs first
    {
      name: 'setup',
      testMatch: /setup\/auth\.setup\.ts/,
    },
    // Household setup — needs valid session from auth setup
    {
      name: 'household-setup',
      testMatch: /setup\/household\.setup\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'tests/e2e/.auth/user.json' },
    },
    // All tests use the saved session and depend on both setup steps
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
        timezoneId: 'America/New_York',
      },
      testIgnore: /auth\.spec\.ts/,
      dependencies: ['household-setup'],
    },
    // Re-run date-sensitive specs in UTC+13 to catch day-shift bugs
    {
      name: 'tz-ahead',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
        timezoneId: 'Pacific/Auckland',
      },
      testMatch: [
        /analytics-breakdown\.spec\.ts/,
        /budgeting\.spec\.ts/,
        /dedupe\.spec\.ts/,
        /settings-household\.spec\.ts/,
        /settings-invitations\.spec\.ts/,
        /transactions-manage\.spec\.ts/,
        /transactions-upload\.spec\.ts/,
      ],
      dependencies: ['household-setup'],
    },
    // Re-run date-sensitive specs in UTC-10 to catch day-shift bugs
    {
      name: 'tz-behind',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
        timezoneId: 'Pacific/Honolulu',
      },
      testMatch: [
        /analytics-breakdown\.spec\.ts/,
        /budgeting\.spec\.ts/,
        /dedupe\.spec\.ts/,
        /settings-household\.spec\.ts/,
        /settings-invitations\.spec\.ts/,
        /transactions-manage\.spec\.ts/,
        /transactions-upload\.spec\.ts/,
      ],
      dependencies: ['household-setup'],
    },
    // Auth spec runs last — sign-out invalidates the server session
    {
      name: 'auth-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      testMatch: /auth\.spec\.ts/,
      dependencies: ['chromium', 'tz-ahead', 'tz-behind'],
    },
  ],

  webServer: {
    command: process.env.CI ? 'npm run build && npm run start -- -p 3000' : 'npm run dev -- -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Point the server at the E2E database, not the dev/prod one
      DATABASE_URL: process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL ?? '',
    },
  },
})
