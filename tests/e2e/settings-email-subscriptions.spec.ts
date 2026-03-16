import { test, expect } from './fixtures'

test.describe('settings — email subscriptions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/email-subscriptions')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('weekly summary toggle state persists across reload', async ({ page }) => {
    const row = page.getByRole('row', { name: /E2E Test Household/i })
    const toggle = row.getByRole('switch')
    await expect(toggle).toBeVisible()

    const wasChecked = await toggle.isChecked()

    // Toggle off (or on if already off)
    await toggle.click()
    await expect(page.getByText('Email subscription updated')).toBeVisible()

    await page.reload()

    const nowChecked = await toggle.isChecked()
    expect(nowChecked).toBe(!wasChecked)

    // Restore original state
    await toggle.click()
    await expect(page.getByText('Email subscription updated')).toBeVisible()
  })
})
