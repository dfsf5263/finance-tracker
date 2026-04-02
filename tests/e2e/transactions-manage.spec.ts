import { test, expect } from './fixtures'
import type { APIRequestContext, Page } from '@playwright/test'
import { displayDate, displayDateFull } from '../../src/lib/date-utils'

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
    const captionText = await popover.getByRole('status').textContent()
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

  const ariaLabel = displayDateFull(year, month, day)
  await popover.getByRole('button', { name: ariaLabel }).click()

  // Wait for the popover to fully close before returning
  await expect(popover).toHaveCount(0)
}

// Unique suffix shared across dependent add → edit → delete tests
const testId = Date.now()
const addDesc = `E2E Purchase ${testId}`

async function cleanupTestTransactions(request: APIRequestContext, ...descriptions: string[]) {
  const householdsRes = await request.get('/api/households')
  if (!householdsRes.ok()) return
  const households = (await householdsRes.json()) as { id: string; name: string }[]
  const hh = households.find((h) => h.name === 'E2E Test Household')
  if (!hh) return

  for (const desc of descriptions) {
    const searchRes = await request.get(
      `/api/transactions?householdId=${hh.id}&search=${encodeURIComponent(desc)}&limit=100`
    )
    if (!searchRes.ok()) continue
    const { transactions } = (await searchRes.json()) as {
      transactions: { id: string; description: string }[]
    }
    for (const tx of transactions.filter((tx) => tx.description === desc)) {
      await request.delete(`/api/transactions/${tx.id}`)
    }
  }
}

test.describe('transaction management', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/manage')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterAll(async ({ request }) => {
    await cleanupTestTransactions(
      request,
      addDesc,
      `E2E Edited ${testId}`,
    )
    // Clean up any "E2E TZ Date" transactions left from this run
    const householdsRes = await request.get('/api/households')
    if (!householdsRes.ok()) return
    const households = (await householdsRes.json()) as { id: string; name: string }[]
    const hh = households.find((h) => h.name === 'E2E Test Household')
    if (!hh) return
    const searchRes = await request.get(
      `/api/transactions?householdId=${hh.id}&search=${encodeURIComponent('E2E TZ Date')}&limit=100`
    )
    if (!searchRes.ok()) return
    const { transactions } = (await searchRes.json()) as {
      transactions: { id: string; description: string }[]
    }
    for (const tx of transactions.filter((tx) => tx.description.startsWith('E2E TZ Date'))) {
      await request.delete(`/api/transactions/${tx.id}`)
    }
  })

  test('transaction grid loads', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('add transaction: form submits and new row appears', async ({ page }) => {
    // Open add transaction form via the page card (not the header button)
    await page.getByRole('heading', { name: 'Add Transaction', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Select account
    await dialog.getByRole('combobox').filter({ hasText: /select account/i }).click()
    await page.getByRole('option').first().click()

    // Select category
    await dialog.getByRole('combobox').filter({ hasText: /select category/i }).click()
    await page.getByRole('option').first().click()

    // Select type
    await dialog.getByRole('combobox').filter({ hasText: /select type/i }).click()
    await page.getByRole('option').first().click()

    // Fill text fields last — combobox selections can trigger re-renders that clear controlled inputs
    await dialog.getByRole('textbox', { name: /description/i }).fill(addDesc)
    await dialog.getByRole('spinbutton', { name: /amount/i }).fill('42.00')

    await dialog.getByRole('button', { name: /create transaction/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('cell', { name: addDesc })).toBeVisible()
  })

  test('edit transaction: change description and save', async ({ page }) => {
    const uniqueDesc = `E2E Edited ${testId}`
    const targetRow = page.getByRole('row').filter({ hasText: addDesc })
    await targetRow.getByRole('cell').last().getByRole('button').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('textbox', { name: /description/i }).fill(uniqueDesc)
    await dialog.getByRole('button', { name: /update transaction/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('cell', { name: uniqueDesc })).toBeVisible()
  })

  test('delete transaction: row is removed after confirmation', async ({ page }) => {
    const firstDataRow = page.getByRole('row').nth(1)
    const descriptionCell = firstDataRow.getByRole('cell').nth(3)
    const descriptionText = await descriptionCell.textContent()

    // Second button in the actions cell is delete
    await firstDataRow.getByRole('cell').last().getByRole('button').last().click()

    if (descriptionText) {
      await expect(page.getByRole('cell', { name: descriptionText }).first()).not.toBeVisible({ timeout: 10000 })
    }
  })

  test('pagination: navigating to next page changes displayed rows', async ({ page }) => {
    const nextBtn = page.getByRole('main').getByRole('button', { name: 'Next', exact: true })
    if (!(await nextBtn.isEnabled())) {
      test.skip(true, 'Not enough transactions to paginate')
      return
    }
    const firstPageDesc = await page.getByRole('row').nth(1).getByRole('cell').nth(3).textContent()
    await nextBtn.click()
    await page.waitForTimeout(500)
    const secondPageDesc = await page.getByRole('row').nth(1).getByRole('cell').nth(3).textContent()
    expect(firstPageDesc).not.toBe(secondPageDesc)
  })

  test('created transaction date matches the date picked in the calendar', async ({ page }) => {
    const tzDesc = `E2E TZ Date ${Date.now()}`

    await page.getByRole('heading', { name: 'Add Transaction', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Pick a specific date — Jan 15, 2026 — via the calendar widget
    await pickDate(page, 'Transaction Date', 2026, 1, 15)

    // Select account, category, type
    await dialog.getByRole('combobox').filter({ hasText: /select account/i }).click()
    await page.getByRole('option').first().click()
    await dialog.getByRole('combobox').filter({ hasText: /select category/i }).click()
    await page.getByRole('option').first().click()
    await dialog.getByRole('combobox').filter({ hasText: /select type/i }).click()
    await page.getByRole('option').first().click()

    // Fill text fields
    await dialog.getByRole('textbox', { name: /description/i }).fill(tzDesc)
    await dialog.getByRole('spinbutton', { name: /amount/i }).fill('77.00')

    await dialog.getByRole('button', { name: /create transaction/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10000 })

    // The new transaction is in Jan 2026 but the grid defaults to the current month,
    // so search by description to surface it on the first page.
    await page.getByRole('textbox', { name: /search transactions/i }).fill(tzDesc)

    // The grid should contain the new row with the EXACT date we picked.
    // If dateToISOLocal() shifted ±1 day due to timezone, this assertion fails.
    const newRow = page.getByRole('row').filter({ hasText: tzDesc })
    await expect(newRow).toBeVisible()
    await expect(newRow.getByRole('cell', { name: displayDate('2026-01-15') })).toBeVisible()
  })
})
