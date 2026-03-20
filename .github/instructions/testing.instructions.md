---
description: "Use when writing or modifying unit tests (Vitest) or E2E tests (Playwright). Covers test patterns, mocking, and test organization."
applyTo: "**/*.test.{ts,tsx}, tests/e2e/**"
---

# Testing Standards

## Unit Tests (Vitest)

### Setup

- Config: `vitest.config.ts` (jsdom environment)
- Setup file: `src/test/setup.ts` — mocks `next/navigation`, `next/headers`, and logger
- Database mock: `mockDb` via `vitest-mock-extended`

### Conventions

- Co-locate test files with source: `my-file.test.ts` next to `my-file.ts`
- Use `describe`/`it` blocks with clear descriptions
- Reset mocks between tests with `beforeEach`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles the expected case', () => {
    expect(myFunction('input')).toBe('output')
  })

  it('throws on invalid input', () => {
    expect(() => myFunction('')).toThrow()
  })
})
```

### Mocking

- Place `vi.mock()` calls at the top of the file, before other imports
- Use `vi.mock()` for module mocks
- Use `mockDb` from `src/test/setup.ts` for Prisma queries
- Call `mockReset(mockDb)` in `beforeEach` to reset database mocks
- Use `vi.mocked(dependency)` to get typed access to mocked functions
- Suppress console output in `beforeEach`:

```ts
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
```

- For API route tests, mock `requireAuth`/`requireHouseholdAccess`, `db`, and validate both success and error paths

### Running

- All tests: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

## E2E Tests (Playwright)

### Setup

- Config: `playwright.config.ts`
- Test directory: `tests/e2e/`
- Base URL: `http://localhost:3000`
- Browser: Chromium

### Test Execution Order

Projects run with dependencies:
1. `setup` — Creates test user, saves auth state
2. `household-setup` — Creates test household
3. `chromium` — Main tests (authenticated, `America/New_York`)
4. `tz-ahead` — Date-sensitive specs in `Pacific/Auckland` (UTC+13)
5. `tz-behind` — Date-sensitive specs in `Pacific/Honolulu` (UTC-10)
6. `auth-tests` — Auth-specific tests (unauthenticated, runs last)

### Auth State

- Stored in `.auth/user.json` after setup
- Reused across test projects via `storageState`
- E2E credentials: `E2E_EMAIL` / `E2E_PASSWORD` env vars

### Patterns

```ts
import { test, expect } from '@playwright/test'

test('displays transaction list', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
})
```

### Running

- Full suite: `npm run test:e2e`
- No-email suite: `npm run test:e2e:no-email`
- E2E database reset: `npm run db:e2e:reset`
