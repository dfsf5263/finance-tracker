import type { APIRequestContext } from '@playwright/test'
import path from 'path'
import { displayDate } from '../../src/lib/date-utils'
import { expect, test } from './fixtures'

const FIXTURES = path.resolve(__dirname, '../../test')

// Descriptions from sample-transactions-e2e.csv that get inserted on every upload
const CSV_DESCRIPTIONS = [
  'Grocery Store Purchase',
  'Coffee Shop Visit',
  'Salary Deposit',
  'Restaurant Bill',
  'Electric Bill',
  'Movie Tickets',
]

/**
 * Delete all transactions whose description matches any of the CSV descriptions.
 * Runs before each test so leftover data from previous (possibly failed) runs
 * doesn't pollute the current run.
 */
async function cleanupCsvTransactions(request: APIRequestContext) {
  const householdsRes = await request.get('/api/households')
  if (!householdsRes.ok()) return
  const households = (await householdsRes.json()) as { id: string; name: string }[]
  const hh = households.find((h) => h.name === 'E2E Test Household')
  if (!hh) return

  for (const desc of CSV_DESCRIPTIONS) {
    const searchRes = await request.get(
      `/api/transactions?householdId=${hh.id}&search=${encodeURIComponent(desc)}&limit=100`
    )
    if (!searchRes.ok()) continue
    const { transactions } = (await searchRes.json()) as {
      transactions: { id: string; description: string }[]
    }
    // Only delete exact description matches — the search API does broad `contains`
    const exact = transactions.filter((tx) => tx.description === desc)
    for (const tx of exact) {
      await request.delete(`/api/transactions/${tx.id}`)
    }
  }
}

test.describe('CSV bulk upload', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupCsvTransactions(page.request)
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('uploads valid CSV and shows success summary', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample-transactions-e2e.csv'))

    // Step 2: Map Columns — auto-mapped, click Continue to Preview
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    // Step 3: Preview — click Upload N Transactions
    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()

    // Step 4: Complete — success summary
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('Successful', { exact: true })).toBeVisible()
  })

  test('uploads CSV with row errors and shows error table', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample-transactions-errors.csv'))

    // Proceed through mapping to preview where validation errors surface
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    // Validation errors or upload failures should appear
    await expect(page.getByRole('heading', { name: /validation errors/i })).toBeVisible({
      timeout: 15000,
    })
  })

  test('uploads CSV with different headers and surfaces mapping UI', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample-transactions-different-headers.csv'))
    // Column mapping step should appear
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('client-side validation errors shown in preview step', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.join(FIXTURES, 'sample-transactions-client-validation-errors.csv')
    )
    // Mapping step appears; proceed to preview to trigger client validation
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(page.getByRole('heading', { name: /validation errors/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('uploaded transactions appear on manage page with correct dates', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample-transactions-e2e.csv'))

    // Step 2: Map Columns
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    // Step 3: Preview — upload
    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()

    // Step 4: Complete
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })

    // Navigate to the manage page and verify the uploaded transaction appears with the correct date.
    // The CSV contains 01/15/2024 (MM/DD/YYYY) — if mdyToISO() shifted ±1 day due to
    // timezone, the displayed date will be wrong.
    await page.goto('/dashboard/transactions/manage')
    await expect(page.getByRole('table')).toBeVisible()

    // The uploaded transaction is from Jan 2024 — search to surface it past pagination.
    await page.getByRole('textbox', { name: /search transactions/i }).fill('Grocery Store Purchase')

    const uploadedRow = page.getByRole('row').filter({ hasText: 'Grocery Store Purchase' }).first()
    await expect(uploadedRow).toBeVisible({ timeout: 10000 })
    await expect(uploadedRow.getByRole('cell', { name: displayDate('2024-01-15') })).toBeVisible()
  })
})
