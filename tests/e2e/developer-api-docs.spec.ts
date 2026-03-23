import { test, expect } from './fixtures'

test.describe('developer — API docs', () => {
  test('page loads with back-to-dashboard banner and API reference', async ({ page }) => {
    await page.goto('/docs')

    // Banner is visible with link back to dashboard
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeVisible()

    // Scalar renders the spec title from the inline content
    await expect(page.getByText('Finance Tracker API')).toBeVisible({ timeout: 15000 })

    await page.getByRole('link', { name: /back to dashboard/i }).click()
    await page.waitForURL('/dashboard')
    await expect(page.getByRole('main')).toBeVisible()
  })
})
