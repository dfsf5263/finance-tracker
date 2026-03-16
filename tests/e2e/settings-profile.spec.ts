import { test, expect } from './fixtures'

test.describe('settings — profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/profile')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('can update first and last name and change reflects in nav', async ({ page }) => {
    await page.getByLabel(/first name/i).fill('E2E')
    await page.getByLabel(/last name/i).fill('Updated')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/profile updated successfully/i)).toBeVisible()
    // Name should be reflected in the sidebar user button once session re-fetches
    await expect(page.getByRole('button', { name: /E2E Updated/i })).toBeVisible({ timeout: 10000 })

    // Restore original name
    await page.getByLabel(/first name/i).fill('E2E')
    await page.getByLabel(/last name/i).fill('User')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/profile updated successfully/i)).toBeVisible()
  })
})
