import { test, expect } from './fixtures'
import type { APIRequestContext, Page } from '@playwright/test'
import { displayDateFull } from '../../src/lib/date-utils'

// ── Helpers ─────────────────────────────────────────────────

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
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)

  await page.getByText(labelText, { exact: true }).locator('..').getByRole('button').click()

  const popover = page.locator('[data-slot="popover-content"]')
  await popover.waitFor({ state: 'visible' })

  for (let guard = 0; guard < 120; guard++) {
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
  await expect(popover).toHaveCount(0)
}

const EXPORT_TX_DESC = `E2E Export Test ${Date.now()}`

async function getHouseholdId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/households')
  const households = (await res.json()) as { id: string; name: string }[]
  const hh = households.find((h) => h.name === 'E2E Test Household')
  if (!hh) throw new Error('E2E Test Household not found')
  return hh.id
}

async function cleanupTestTransactions(request: APIRequestContext, description: string) {
  const hhId = await getHouseholdId(request)
  const searchRes = await request.get(
    `/api/transactions?householdId=${hhId}&search=${encodeURIComponent(description)}&limit=100`,
  )
  const { transactions } = (await searchRes.json()) as {
    transactions: { id: string; description: string }[]
  }
  for (const tx of transactions.filter((tx) => tx.description === description)) {
    await request.delete(`/api/transactions/${tx.id}`)
  }
}

// ── Tests ───────────────────────────────────────────────────

test.describe('Export utility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/utility/export')
    await expect(page.getByRole('main')).toBeVisible()
  })

  // ── Page render & navigation ──────────────────────────────

  test('page loads and shows correct header title', async ({ page }) => {
    await expect(page.getByText('Utility - Export')).toBeVisible()
  })

  test('sidebar Export link is active', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Export', exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('data-active', 'true')
  })

  test('page shows card with export heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Export Transactions' })).toBeVisible()
  })

  // ── Initial state ─────────────────────────────────────────

  test('export button is disabled initially', async ({ page }) => {
    const btn = page.getByRole('button', { name: /^export$/i })
    await expect(btn).toBeDisabled()
  })

  test('format select, start date, and end date are visible', async ({ page }) => {
    await expect(page.getByText('File Format')).toBeVisible()
    await expect(page.getByText('Start Date', { exact: true })).toBeVisible()
    await expect(page.getByText('End Date', { exact: true })).toBeVisible()
  })

  // ── Format select ─────────────────────────────────────────

  test('format dropdown shows CSV and Excel options', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await expect(page.getByRole('option', { name: 'CSV (.csv)' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Excel (.xlsx)' })).toBeVisible()
  })

  // ── Date range validation ─────────────────────────────────

  test('shows warning when start date is after end date', async ({ page }) => {
    // Pick end date first (Jan 1) then start date (Jan 31) so start > end
    await pickDate(page, 'End Date', 2024, 1, 1)
    await pickDate(page, 'Start Date', 2024, 1, 31)

    await expect(page.getByText('Start date must be before end date')).toBeVisible()
    await expect(page.getByRole('button', { name: /^export$/i })).toBeDisabled()
  })

  // ── Transaction count preview ─────────────────────────────

  test('shows "No transactions found" for date range with no data', async ({ page }) => {
    // Seed data starts at 2024-01-01, so Nov 2023 is guaranteed empty (~29 months back)
    await pickDate(page, 'Start Date', 2023, 11, 1)
    await pickDate(page, 'End Date', 2023, 11, 30)

    await expect(page.getByText('No transactions found for the selected date range')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('button', { name: /^export$/i })).toBeDisabled()
  })

  test('shows transaction count for date range with data', async ({ page }) => {
    // Jan 2024 has seeded budget-test transactions
    await pickDate(page, 'Start Date', 2024, 1, 1)
    await pickDate(page, 'End Date', 2024, 1, 31)

    // Should show a count like "N transactions"
    await expect(page.getByText(/\d+ transactions/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('No transactions found')).toHaveCount(0)
  })

  test('export button enabled when format and valid date range selected', async ({ page }) => {
    // Select format
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'CSV (.csv)' }).click()

    // Pick date range with known data (Jan 2024 budget test transactions)
    await pickDate(page, 'Start Date', 2024, 1, 1)
    await pickDate(page, 'End Date', 2024, 1, 31)

    // Wait for count to load
    await expect(page.getByText(/\d+ transactions/)).toBeVisible({ timeout: 10000 })

    await expect(page.getByRole('button', { name: /^export$/i })).toBeEnabled()
  })

  test('export button stays disabled when format selected but no dates', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'CSV (.csv)' }).click()

    await expect(page.getByRole('button', { name: /^export$/i })).toBeDisabled()
  })

  // ── CSV export ────────────────────────────────────────────

  test('CSV export triggers download with correct filename', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'CSV (.csv)' }).click()

    await pickDate(page, 'Start Date', 2024, 1, 1)
    await pickDate(page, 'End Date', 2024, 1, 31)

    await expect(page.getByText(/\d+ transactions/)).toBeVisible({ timeout: 10000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^export$/i }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe(
      'transactions-export-2024-01-01-to-2024-01-31.csv',
    )
  })

  // ── Excel export ──────────────────────────────────────────

  test('Excel export triggers download with correct filename', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Excel (.xlsx)' }).click()

    await pickDate(page, 'Start Date', 2024, 1, 1)
    await pickDate(page, 'End Date', 2024, 1, 31)

    await expect(page.getByText(/\d+ transactions/)).toBeVisible({ timeout: 10000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^export$/i }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe(
      'transactions-export-2024-01-01-to-2024-01-31.xlsx',
    )
  })

  // ── CSV content validation ────────────────────────────────

  test('exported CSV contains correct headers and seeded transaction data', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'CSV (.csv)' }).click()

    // Jan 2024 has deterministic budget-test transactions
    await pickDate(page, 'Start Date', 2024, 1, 1)
    await pickDate(page, 'End Date', 2024, 1, 31)

    await expect(page.getByText(/\d+ transactions/)).toBeVisible({ timeout: 10000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^export$/i }).click()
    const download = await downloadPromise

    // Read the downloaded CSV content
    const stream = await download.createReadStream()
    expect(stream, 'download stream should not be null').not.toBeNull()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) {
      chunks.push(chunk as Buffer)
    }
    const csvContent = Buffer.concat(chunks).toString('utf-8')

    // Verify header
    const lines = csvContent.split('\n')
    expect(lines[0]).toBe(
      'Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
    )

    // Verify seeded transactions are present — budget test transactions from seed
    expect(csvContent).toContain('Budget Test: Concert Jan')
    expect(csvContent).toContain('Budget Test: Theater Jan')
    expect(csvContent).toContain('Budget Test: Grocery Jan')

    // Verify date format is MM/DD/YYYY
    expect(csvContent).toMatch(/01\/10\/2024/)
    expect(csvContent).toMatch(/01\/20\/2024/)

    // Verify entity names are present
    expect(csvContent).toContain('E2E Checking')
    expect(csvContent).toContain('Entertainment')
    expect(csvContent).toContain('Sale')
  })
})

// ── Transaction creation → export validation ────────────────

test.describe('Export with created transaction', () => {
  test.afterAll(async ({ request }) => {
    await cleanupTestTransactions(request, EXPORT_TX_DESC)
  })

  test('transaction created via API appears in CSV export for its date range', async ({
    page,
    request,
  }) => {
    // 1. Create a transaction via API for a unique date range
    const hhId = await getHouseholdId(request)

    // Get entity IDs
    const [accountsRes, categoriesRes, typesRes] = await Promise.all([
      request.get(`/api/accounts?householdId=${hhId}`),
      request.get(`/api/categories?householdId=${hhId}`),
      request.get(`/api/types?householdId=${hhId}`),
    ])

    const accounts = (await accountsRes.json()) as { id: string; name: string }[]
    const categories = (await categoriesRes.json()) as { id: string; name: string }[]
    const types = (await typesRes.json()) as { id: string; name: string }[]

    const account = accounts.find((a) => a.name === 'E2E Checking')!
    const category = categories.find((c) => c.name === 'Groceries')!
    const type = types.find((t) => t.name === 'Sale')!

    // Create transaction on a specific date (March 15, 2025 — unique date range)
    const createRes = await request.post('/api/transactions', {
      data: {
        householdId: hhId,
        accountId: account.id,
        userId: null,
        categoryId: category.id,
        typeId: type.id,
        description: EXPORT_TX_DESC,
        amount: -99.42,
        transactionDate: '2025-03-15',
        postDate: '2025-03-15',
        memo: 'E2E export validation',
      },
    })
    expect(createRes.ok()).toBeTruthy()

    // 2. Navigate to export page and export CSV for that date range
    await page.goto('/dashboard/utility/export')
    await expect(page.getByRole('main')).toBeVisible()

    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'CSV (.csv)' }).click()

    await pickDate(page, 'Start Date', 2025, 3, 1)
    await pickDate(page, 'End Date', 2025, 3, 31)

    await expect(page.getByText(/\d+ transactions/)).toBeVisible({ timeout: 10000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^export$/i }).click()
    const download = await downloadPromise

    // 3. Verify the created transaction appears in the CSV
    const stream = await download.createReadStream()
    expect(stream, 'download stream should not be null').not.toBeNull()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) {
      chunks.push(chunk as Buffer)
    }
    const csvContent = Buffer.concat(chunks).toString('utf-8')

    // Verify our specific transaction is in the export
    expect(csvContent).toContain(EXPORT_TX_DESC)
    expect(csvContent).toContain('E2E Checking')
    expect(csvContent).toContain('Groceries')
    expect(csvContent).toContain('Sale')
    expect(csvContent).toContain('03/15/2025')
    expect(csvContent).toContain('-99.42')
    expect(csvContent).toContain('E2E export validation')

    // Verify filename
    expect(download.suggestedFilename()).toBe(
      'transactions-export-2025-03-01-to-2025-03-31.csv',
    )
  })
})
