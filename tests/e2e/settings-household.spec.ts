import { test, expect } from './fixtures'

test.describe('settings — household', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/household')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('overview tab displays household name and role', async ({ page }) => {
    const overview = page.getByRole('tabpanel', { name: 'Overview' })
    await expect(overview.getByText('E2E Test Household')).toBeVisible()
    await expect(overview.getByText('OWNER')).toBeVisible()
  })

  test('overview tab displays annual budget', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /annual budget/i })).toBeVisible()
  })
})
