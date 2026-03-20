import { test, expect } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

const HOUSEHOLD_NAME = 'E2E Test Household'
const BASELINE_BUDGET = 60000

/** Return the E2E household id, or throw if it can't be found. */
async function getE2EHouseholdId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/households')
  if (!res.ok()) throw new Error(`GET /api/households failed: ${res.status()}`)
  const households = (await res.json()) as { id: string; name: string }[]
  const hh = households.find((h) => h.name === HOUSEHOLD_NAME)
  if (!hh) throw new Error(`E2E household "${HOUSEHOLD_NAME}" not found`)
  return hh.id
}

/** Reset the E2E household budget to the baseline value so tests are idempotent. */
async function resetHouseholdBudget(request: APIRequestContext): Promise<void> {
  const id = await getE2EHouseholdId(request)
  const res = await request.put(`/api/households/${id}`, {
    data: { name: HOUSEHOLD_NAME, annualBudget: BASELINE_BUDGET },
  })
  if (!res.ok()) throw new Error(`Failed to reset household budget: ${res.status()}`)
}

test.describe('definitions — households', () => {
  test.beforeEach(async ({ page }) => {
    await resetHouseholdBudget(page.request)
    await page.goto('/dashboard/definitions/households')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('E2E household is visible in the list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: HOUSEHOLD_NAME })).toBeVisible()
  })

  test('E2E household shows correct role badge', async ({ page }) => {
    const card = page.locator('.border.border-border', { hasText: HOUSEHOLD_NAME })
    await expect(card.getByText('Owner')).toBeVisible()
  })

  test('E2E household shows baseline annual budget', async ({ page }) => {
    const card = page.locator('.border.border-border', { hasText: HOUSEHOLD_NAME })
    await expect(card.getByText(/\$60,000\.00/)).toBeVisible()
  })

  test('edit household: updated budget shown in card', async ({ page }) => {
    const card = page.locator('.border.border-border', { hasText: HOUSEHOLD_NAME })

    // Open the edit dialog via the edit (pencil) button
    await card.getByRole('button', { name: /edit household/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: /edit household/i })).toBeVisible()

    // Update annual budget
    const budgetInput = dialog.getByLabel(/annual budget/i)
    await budgetInput.clear()
    await budgetInput.fill('75000')
    await dialog.getByRole('button', { name: /update household/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10000 })

    // Verify the updated budget is reflected in the card
    await expect(card.getByText(/\$75,000\.00/)).toBeVisible({ timeout: 10000 })
  })
})
