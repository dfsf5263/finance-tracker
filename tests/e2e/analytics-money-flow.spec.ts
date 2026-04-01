import { test, expect } from './fixtures'

test.describe('analytics money flow (Sankey)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/analytics/money-flow')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('Sankey SVG renders and is non-empty', async ({ page }) => {
    const svg = page.locator('svg').first()
    await expect(svg).toBeVisible({ timeout: 15000 })
    // Should contain at least one path/rect element (nodes or links)
    await expect(svg.locator('path, rect').first()).toBeVisible()
  })

  test('page loads without error', async ({ page }) => {
    await expect(page.locator('[class*="error"], [data-testid="error"]')).not.toBeVisible()
  })

  test('date range controls are present', async ({ page }) => {
    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentMonth = now.toLocaleString('en-US', { month: 'long' })
    await expect(page.getByRole('combobox').filter({ hasText: /By Month|By Year/i })).toBeVisible()
    await expect(
      page.getByRole('combobox').filter({ hasText: new RegExp(currentYear) })
    ).toBeVisible()
    await expect(
      page.getByRole('combobox').filter({ hasText: new RegExp(currentMonth, 'i') })
    ).toBeVisible()
  })
})
