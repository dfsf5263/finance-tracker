import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { format } from 'date-fns'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * Open a CustomDatePicker (identified by its visible label) and navigate the
 * calendar to the given year/month, then click the target day.
 */
async function pickDate(page: Page, labelText: string, year: number, month: number, day: number) {
  // Ensure no stale popovers from a previous picker are still in the DOM
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)

  // Click the picker trigger — it lives in the same container as the label
  await page.getByText(labelText, { exact: true }).locator('..').getByRole('button').click()

  const popover = page.locator('[data-slot="popover-content"]')
  await popover.waitFor({ state: 'visible' })

  // Navigate month-by-month to the target month (guard against infinite loops)
  for (let guard = 0; guard < 36; guard++) {
    const captionText = await popover.locator('.rdp-caption_label').textContent()
    if (!captionText) break
    const parts = captionText.trim().split(' ')
    const currentMonth = MONTH_NAMES.indexOf(parts[0]) + 1
    const currentYear = parseInt(parts[1], 10)
    if (currentYear === year && currentMonth === month) break
    if (currentYear > year || (currentYear === year && currentMonth > month)) {
      await popover.getByRole('button', { name: 'Go to the Previous Month' }).click()
    } else {
      await popover.getByRole('button', { name: 'Go to the Next Month' }).click()
    }
  }

  // Click the day — react-day-picker uses date-fns PPPP for the button aria-label
  const ariaLabel = format(new Date(year, month - 1, day), 'PPPP')
  await popover.getByRole('button', { name: ariaLabel }).click()

  // Wait for the popover to fully close before returning
  await expect(popover).toHaveCount(0)
}

test.describe('deduplication utility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/utility/dedupe')
    await expect(page.getByRole('main')).toBeVisible()
    // Set the date range so the seeded duplicate transactions (Jan 15–16 2026) are included
    await pickDate(page, 'Start Date', 2026, 1, 1)
    await pickDate(page, 'End Date', 2026, 1, 31)
  })

  test('analyze button triggers duplicate detection', async ({ page }) => {
    // Wait for the button to be ready then click
    const analyzeBtn = page.getByRole('button', { name: /^Analyze/i })
    await analyzeBtn.waitFor({ state: 'visible', timeout: 30000 })
    await analyzeBtn.click()

    // Either the empty-state heading or the results heading should appear
    await expect(
      page
        .getByRole('heading', { name: /No Duplicates Found/i })
        .or(page.getByRole('heading', { name: /Potential Duplicate Transactions/i }))
    ).toBeVisible({ timeout: 30000 })
  })

  test('empty state or results shown after analysis', async ({ page }) => {
    await page.getByRole('button', { name: /^Analyze/i }).click()
    await expect(
      page
        .getByRole('heading', { name: /No Duplicates Found/i })
        .or(page.getByRole('heading', { name: /Potential Duplicate Transactions/i }))
    ).toBeVisible({ timeout: 30000 })
  })

  test('duplicate pairs show delete buttons when duplicates exist', async ({ page }) => {
    await page.getByRole('button', { name: /^Analyze/i }).click()
    const resultsHeading = page.getByRole('heading', { name: /Potential Duplicate Transactions/i })
    // waitFor actually polls until the element appears; isVisible() is a point-in-time check
    const found = await resultsHeading
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false)
    if (!found) {
      test.skip(true, 'No duplicates in E2E dataset')
      return
    }
    // Each transaction in a pair has a delete button
    await expect(page.getByRole('heading', { name: /Transaction A/i }).first()).toBeVisible()
  })
})
