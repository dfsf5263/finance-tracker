import { test, expect } from './fixtures'

test.describe('settings — household members', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/household?tab=members')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('members list shows current user with OWNER role', async ({ page }) => {
    await expect(page.getByText('e2e@test.local')).toBeVisible()
    await expect(page.getByRole('tabpanel').getByText('OWNER', { exact: true })).toBeVisible()
  })

  test('members tab is active when ?tab=members is in URL', async ({ page }) => {
    // The members tab content should be visible
    await expect(page.getByRole('tabpanel')).toBeVisible()
  })
})
