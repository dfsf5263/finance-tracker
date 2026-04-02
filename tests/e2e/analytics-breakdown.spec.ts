import { test, expect } from './fixtures'

test.describe('analytics breakdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/analytics/breakdown')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('category breakdown chart renders', async ({ page }) => {
    // Chart should render at least an SVG or canvas element
    const chart = page.locator('svg, canvas, [class*="chart"], [class*="recharts"]').first()
    await expect(chart).toBeVisible({ timeout: 15000 })
  })

  test('page loads without error', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible()
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
