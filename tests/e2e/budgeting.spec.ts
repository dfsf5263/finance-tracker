import { test, expect, type Page } from './fixtures'

/** Select a specific year + month on the household budget page. */
async function selectMonth(page: Page, year: string, month: string) {
  // The Time Period section has 3 comboboxes: period type (0), year (1), month (2)
  const comboboxes = page.getByText('Time Period').locator('..').locator('..').getByRole('combobox')

  // Year selector
  await comboboxes.nth(1).click()
  await page.getByRole('option', { name: year, exact: true }).click()

  // Month selector
  await comboboxes.nth(2).click()
  await page.getByRole('option', { name: month, exact: true }).click()
}

test.describe('budgeting', () => {
  test('household budget page renders budget vs actual values', async ({ page }) => {
    await page.goto('/dashboard/budgeting/household-budget')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(
      page.getByText(/budget|spending|actual/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('user budget page loads', async ({ page }) => {
    await page.goto('/dashboard/budgeting/user-budget')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.locator('[class*="error"], [data-testid="error"]')).not.toBeVisible()
  })

  test('over-budget month shows categories over budget', async ({ page }) => {
    await page.goto('/dashboard/budgeting/household-budget')
    await expect(page.getByRole('main')).toBeVisible()

    // Navigate to January 2024 — seeded with Entertainment spend > $100 budget
    await selectMonth(page, '2024', 'January')

    // Wait for data to load and verify at least one category is over budget
    const overBudgetLabel = page.getByText('Categories Over Budget')
    await expect(overBudgetLabel).toBeVisible({ timeout: 15000 })
    // The count is a sibling <p> — grab the parent card and verify count > 0
    const card = overBudgetLabel.locator('..').locator('..')
    await expect(card).not.toContainText('Categories Over Budget0', { timeout: 10000 })
    // The detailed row should show a negative variance (e.g. "-$239.70")
    await expect(page.getByText(/-\$\d/).first()).toBeVisible({ timeout: 10000 })
  })

  test('under-budget month shows zero categories over budget', async ({ page }) => {
    await page.goto('/dashboard/budgeting/household-budget')
    await expect(page.getByRole('main')).toBeVisible()

    // Navigate to February 2024 — seeded with minimal spend under all budgets
    await selectMonth(page, '2024', 'February')

    // Wait for data to load
    const overBudgetLabel = page.getByText('Categories Over Budget')
    await expect(overBudgetLabel).toBeVisible({ timeout: 15000 })
    // Verify the count is 0
    const card = overBudgetLabel.locator('..').locator('..')
    await expect(card).toContainText('Categories Over Budget0', { timeout: 10000 })
  })
})
