import type { Locator, Page } from '@playwright/test'
import crypto from 'crypto'
import ExcelJS from 'exceljs'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { displayDate, displayDateFull } from '../../src/lib/date-utils'
import { expect, test } from './fixtures'

const FIXTURES = path.resolve(__dirname, '../../test')

/** Short unique suffix so every test run gets collision-free descriptions. */
function uniqueSuffix(): string {
  return crypto.randomUUID().slice(0, 8)
}

/**
 * Assert the upload completion stats grid shows the expected counts.
 */
async function assertUploadStats(
  page: Page,
  expected: { total: number; successful: number; failed: number },
) {
  const statsGrid = page.locator('.grid.grid-cols-3.text-center')
  await expect(statsGrid.locator('.bg-muted .text-2xl')).toHaveText(String(expected.total))
  await expect(statsGrid.locator('.bg-green-50 .text-2xl')).toHaveText(
    String(expected.successful),
  )
  await expect(statsGrid.locator('.bg-red-50 .text-2xl')).toHaveText(String(expected.failed))
}

// ── Shared base row data ──────────────────────────────────────────────────

interface BaseRow {
  account: string
  user: string
  transactionDate: Date
  postDate: Date
  description: string
  category: string
  type: string
  amount: number
  memo: string
}

/** Return the 6 canonical rows with a unique suffix appended to each description. */
function getBaseRows(suffix: string): BaseRow[] {
  return [
    { account: 'E2E Checking', user: 'E2E User', transactionDate: new Date(2024, 0, 15), postDate: new Date(2024, 0, 17), description: `Grocery Store Purchase ${suffix}`, category: 'Groceries', type: 'Sale', amount: 125.50, memo: 'Weekly shopping' },
    { account: 'E2E Checking', user: 'E2E User', transactionDate: new Date(2024, 0, 16), postDate: new Date(2024, 0, 18), description: `Coffee Shop Visit ${suffix}`, category: 'Food & Drink', type: 'Sale', amount: 45.00, memo: 'Morning coffee' },
    { account: 'E2E Checking', user: 'E2E User', transactionDate: new Date(2024, 0, 17), postDate: new Date(2024, 0, 17), description: `Salary Deposit ${suffix}`, category: 'Paycheck', type: 'Income', amount: 3500.00, memo: 'Monthly salary' },
    { account: 'E2E Checking', user: 'E2E User', transactionDate: new Date(2024, 0, 18), postDate: new Date(2024, 0, 20), description: `Restaurant Bill ${suffix}`, category: 'Food & Drink', type: 'Sale', amount: 85.75, memo: 'Dinner with friends' },
    { account: 'E2E Checking', user: 'E2E User', transactionDate: new Date(2024, 0, 19), postDate: new Date(2024, 0, 19), description: `Electric Bill ${suffix}`, category: 'Bills & Utilities', type: 'Sale', amount: 120.00, memo: 'Monthly electricity' },
    { account: 'E2E Checking', user: 'E2E User', transactionDate: new Date(2024, 0, 20), postDate: new Date(2024, 0, 22), description: `Movie Tickets ${suffix}`, category: 'Entertainment', type: 'Sale', amount: 29.99, memo: 'Weekend movie' },
  ]
}

/** Pad a number with a leading zero for MM/DD formatting. */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Build a temp CSV file from `getBaseRows(suffix)`. Returns the file path. */
function buildCsvFixture(suffix: string): string {
  const rows = getBaseRows(suffix)
  const header = 'Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo'
  const lines = rows.map((r) => {
    const td = r.transactionDate
    const pd = r.postDate
    const txDate = `${pad(td.getMonth() + 1)}/${pad(td.getDate())}/${td.getFullYear()}`
    const pDate = `${pad(pd.getMonth() + 1)}/${pad(pd.getDate())}/${pd.getFullYear()}`
    return `${r.account},${r.user},${txDate},${pDate},${r.description},${r.category},${r.type},${r.amount},${r.memo}`
  })
  const content = [header, ...lines].join('\n')
  const tmpPath = path.join(os.tmpdir(), `e2e-csv-${Date.now()}-${suffix}.csv`)
  fs.writeFileSync(tmpPath, content)
  return tmpPath
}

/** Remove a temp file if it exists. */
function cleanupTempFile(filePath: string | undefined) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

// ── Small CSV fixture (3 rows — faster for dry-run / grid tests) ──────────

/** Build a temp 3-row CSV using the first 3 base rows. */
function buildSmallCsvFixture(suffix: string): string {
  const rows = getBaseRows(suffix).slice(0, 3)
  const header = 'Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo'
  const lines = rows.map((r) => {
    const td = r.transactionDate
    const pd = r.postDate
    const txDate = `${pad(td.getMonth() + 1)}/${pad(td.getDate())}/${td.getFullYear()}`
    const pDate = `${pad(pd.getMonth() + 1)}/${pad(pd.getDate())}/${pd.getFullYear()}`
    return `${r.account},${r.user},${txDate},${pDate},${r.description},${r.category},${r.type},${r.amount},${r.memo}`
  })
  const content = [header, ...lines].join('\n')
  const tmpPath = path.join(os.tmpdir(), `e2e-small-csv-${Date.now()}-${suffix}.csv`)
  fs.writeFileSync(tmpPath, content)
  return tmpPath
}

// ── Large Excel fixture (30+ rows — for pagination tests) ────────────────

/** Build a temp Excel file with `count` rows for pagination testing. */
async function buildLargeExcelFixture(suffix: string, count = 30): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('Sheet1')
  ws.columns = [
    { header: 'Account', key: 'account', width: 20 },
    { header: 'User', key: 'user', width: 20 },
    { header: 'Transaction Date', key: 'transactionDate', width: 18 },
    { header: 'Post Date', key: 'postDate', width: 18 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Type', key: 'type', width: 20 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Memo', key: 'memo', width: 30 },
  ]
  for (let i = 0; i < count; i++) {
    const d = new Date(2020, Math.floor(i / 28), 1 + (i % 28))
    const row = ws.addRow({
      account: 'E2E Checking',
      user: 'E2E User',
      transactionDate: d,
      postDate: d,
      description: `Pagination Test ${String(i + 1).padStart(3, '0')} ${suffix}`,
      category: 'Groceries',
      type: 'Sale',
      amount: 10 + i,
      memo: '',
    })
    row.getCell('transactionDate').numFmt = 'mm/dd/yyyy'
    row.getCell('postDate').numFmt = 'mm/dd/yyyy'
  }
  const tmpPath = path.join(os.tmpdir(), `e2e-large-${Date.now()}.xlsx`)
  await workbook.xlsx.writeFile(tmpPath)
  return tmpPath
}

// ── Upload flow helpers ───────────────────────────────────────────────────

/**
 * Upload a file through the full happy-path (upload → mapping → preview → complete)
 * then navigate back to the upload page. Useful for seeding rows before a re-upload test.
 */
async function uploadThroughAndReset(page: Page, filePath: string): Promise<void> {
  await page.goto('/dashboard/transactions/upload')
  await expect(page.getByRole('main')).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles(filePath)
  await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
  await page.getByRole('button', { name: /continue to preview/i }).click()
  // Wait for dry-run to complete before the upload button becomes available
  await expect(
    page.getByRole('button', { name: /upload \d+ transactions/i }),
  ).toBeEnabled({ timeout: 20000 })
  await page.getByRole('button', { name: /upload \d+ transactions/i }).click()
  await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
    timeout: 15000,
  })
  await page.goto('/dashboard/transactions/upload')
  await expect(page.getByRole('main')).toBeVisible()
}

/**
 * Assumes the page is already at /dashboard/transactions/upload.
 * Sets the file input and advances through mapping to the PREVIEW step.
 */
async function setFileAndGoToPreview(page: Page, filePath: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(filePath)
  await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
  await page.getByRole('button', { name: /continue to preview/i }).click()
}

// ── Expansion panel & date picker helpers for the failed-transactions grid ─

/**
 * Expand the nth failure row (0-indexed) and return a locator for the
 * expansion panel content (the next `<tr>` containing editable fields).
 */
async function expandRow(page: Page, index: number): Promise<Locator> {
  await page.getByRole('button', { name: 'Expand details' }).nth(index).click()
  // The expansion <tr> is the sibling immediately following the summary row.
  // Use the "Fix Required Fields" or "Transaction Details" section as anchor.
  const panel = page.locator('tbody tr').filter({
    has: page.getByText('Transaction Details'),
  })
  await expect(panel).toBeVisible()
  return panel
}

/**
 * Return a locator for the nth summary row (0-indexed), skipping expansion rows.
 * Summary rows contain the "Expand details" or "Collapse details" button.
 */
function summaryRow(page: Page, index: number): Locator {
  return page
    .locator('tbody tr')
    .filter({
      has: page.getByRole('button', { name: /expand details|collapse details/i }),
    })
    .nth(index)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Open the CustomDatePicker inside the expansion panel, navigate to the
 * target month, and click the target day.
 * @param container - The expansion panel locator (returned by `expandRow`).
 */
async function pickDateInGrid(
  page: Page,
  container: Locator,
  year: number,
  month: number,
  day: number,
): Promise<void> {
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)
  // Click the date picker trigger (shows "Pick a date" or a formatted date)
  await container.locator('[data-slot="popover-trigger"]').click()
  const popover = page.locator('[data-slot="popover-content"]')
  await popover.waitFor({ state: 'visible' })
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
  await popover.getByRole('button', { name: displayDateFull(year, month, day) }).click()
  await expect(popover).toHaveCount(0)
}

test.describe('CSV bulk upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })
  test('uploads valid CSV and shows success summary', async ({ page }) => {
    const suffix = uniqueSuffix()
    const csvPath = buildCsvFixture(suffix)
    try {
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(csvPath)

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
      await assertUploadStats(page, { total: 6, successful: 6, failed: 0 })
    } finally {
      cleanupTempFile(csvPath)
    }
  })

  // Note: sample-transactions-errors.csv uses 'Source' (not 'Account') as the account header.
  // It is intentionally NOT auto-mapped, so every row fails the client-side 'Account is
  // required' validation — this test covers that specific error path.
  test('client-side required field errors shown when account column is unmapped', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample-transactions-errors.csv'))

    // Proceed through mapping to preview where validation errors surface
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    // Client-side validation issues card should appear
    await expect(page.getByRole('heading', { name: /validation issues/i })).toBeVisible({
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
    await expect(page.getByRole('heading', { name: /validation issues/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('uploaded transactions appear on manage page with correct dates', async ({ page }) => {
    const suffix = uniqueSuffix()
    const csvPath = buildCsvFixture(suffix)
    try {
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(csvPath)

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

      await assertUploadStats(page, { total: 6, successful: 6, failed: 0 })

      // Navigate to the manage page and verify the uploaded transaction appears with the correct date.
      // The CSV contains 01/15/2024 (MM/DD/YYYY) — if mdyToISO() shifted ±1 day due to
      // timezone, the displayed date will be wrong.
      const searchDesc = `Grocery Store Purchase ${suffix}`
      const initialLoadPromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/transactions') && resp.ok(),
      )
      await page.goto('/dashboard/transactions/manage')
      await initialLoadPromise
      await expect(page.getByRole('table')).toBeVisible()

      // The uploaded transaction is from Jan 2024 — search to surface it past pagination.
      const searchPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/transactions') && resp.url().includes('search') && resp.ok(),
      )
      await page.getByRole('textbox', { name: /search transactions/i }).fill(searchDesc)
      await searchPromise

      const uploadedRow = page.getByRole('row').filter({ hasText: searchDesc }).first()
      await expect(uploadedRow).toBeVisible({ timeout: 10000 })
      await expect(uploadedRow.getByRole('cell', { name: displayDate('2024-01-15') })).toBeVisible()
    } finally {
      cleanupTempFile(csvPath)
    }
  })
})

/**
 * Build a .xlsx temp file from `getBaseRows(suffix)`.
 * @param suffix      Unique suffix appended to each description.
 * @param dateNumFmt  numFmt string for date cells — use 'mm/dd/yyyy' for Date cells,
 *                    '@' for Text cells, or undefined for General (raw Date object, no format).
 * @param amountAsText  When true, write amount values as strings instead of numbers.
 */
async function buildExcelFixture(opts: {
  suffix: string
  dateNumFmt?: string
  amountAsText?: boolean
}): Promise<string> {
  const { suffix, dateNumFmt, amountAsText = false } = opts
  const rows = getBaseRows(suffix)
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('Sheet1')

  ws.columns = [
    { header: 'Account', key: 'account', width: 20 },
    { header: 'User', key: 'user', width: 20 },
    { header: 'Transaction Date', key: 'transactionDate', width: 18 },
    { header: 'Post Date', key: 'postDate', width: 18 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Type', key: 'type', width: 20 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Memo', key: 'memo', width: 30 },
  ]

  for (const data of rows) {
    const row = ws.addRow({
      ...data,
      amount: amountAsText ? String(data.amount) : data.amount,
    })

    // Apply date format if provided; leave as General if undefined
    if (dateNumFmt !== undefined) {
      row.getCell('transactionDate').numFmt = dateNumFmt
      row.getCell('postDate').numFmt = dateNumFmt
    }
  }

  const tmpPath = path.join(os.tmpdir(), `e2e-transactions-${Date.now()}.xlsx`)
  await workbook.xlsx.writeFile(tmpPath)
  return tmpPath
}

test.describe('Excel bulk upload', () => {
  let fixturePath: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(async () => {
    cleanupTempFile(fixturePath)
  })

  test('uploads valid Excel file (Date cells) and shows success summary', async ({ page }) => {
    fixturePath = await buildExcelFixture({ suffix: uniqueSuffix(), dateNumFmt: 'mm/dd/yyyy' })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(fixturePath)

    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()

    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    await assertUploadStats(page, { total: 6, successful: 6, failed: 0 })
  })

  test('uploads Excel file with Text-formatted date cells', async ({ page }) => {
    // Build fixture where date cells are formatted as text strings (MM/DD/YYYY)
    const suffix = uniqueSuffix()
    const baseRows = getBaseRows(suffix)
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('Sheet1')
    ws.columns = [
      { header: 'Account', key: 'account', width: 20 },
      { header: 'User', key: 'user', width: 20 },
      { header: 'Transaction Date', key: 'transactionDate', width: 18 },
      { header: 'Post Date', key: 'postDate', width: 18 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Memo', key: 'memo', width: 30 },
    ]
    for (const data of baseRows.slice(0, 1)) {
      const row = ws.addRow({ ...data, transactionDate: '01/15/2024', postDate: '01/17/2024' })
      row.getCell('transactionDate').numFmt = '@'
      row.getCell('postDate').numFmt = '@'
    }
    fixturePath = path.join(os.tmpdir(), `e2e-text-dates-${Date.now()}.xlsx`)
    await workbook.xlsx.writeFile(fixturePath)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(fixturePath)

    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()

    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    await assertUploadStats(page, { total: 1, successful: 1, failed: 0 })
  })

  test('uploads Excel file with General-format date cells', async ({ page }) => {
    // dateNumFmt: undefined → General format (Date object, no numFmt set)
    fixturePath = await buildExcelFixture({ suffix: uniqueSuffix(), dateNumFmt: undefined })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(fixturePath)

    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()

    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    await assertUploadStats(page, { total: 6, successful: 6, failed: 0 })
  })

  test('uploads Excel file with Numeric amount cells', async ({ page }) => {
    fixturePath = await buildExcelFixture({ suffix: uniqueSuffix(), dateNumFmt: 'mm/dd/yyyy', amountAsText: false })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(fixturePath)

    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()

    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    await assertUploadStats(page, { total: 6, successful: 6, failed: 0 })
  })

  test('uploaded Excel transactions appear on manage page with correct dates', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = await buildExcelFixture({ suffix, dateNumFmt: 'mm/dd/yyyy' })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(fixturePath)

    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()

    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    await assertUploadStats(page, { total: 6, successful: 6, failed: 0 })

    // Register the response listener before navigating so we don't miss
    // the initial /api/transactions fetch that fires on page load.
    const searchDesc = `Grocery Store Purchase ${suffix}`
    const initialLoadPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/transactions') && resp.ok(),
    )
    await page.goto('/dashboard/transactions/manage')
    await initialLoadPromise
    await expect(page.getByRole('table')).toBeVisible()

    const searchPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/transactions') && resp.url().includes('search') && resp.ok(),
    )
    await page.getByRole('textbox', { name: /search transactions/i }).fill(searchDesc)
    await searchPromise

    const uploadedRow = page.getByRole('row').filter({ hasText: searchDesc }).first()
    await expect(uploadedRow).toBeVisible({ timeout: 10000 })
    await expect(uploadedRow.getByRole('cell', { name: displayDate('2024-01-15') })).toBeVisible()
  })
})

// =============================================================================
// Suite 1: Dry-run validation in PREVIEW step
// =============================================================================

test.describe('dry-run validation in PREVIEW step', () => {
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('detects duplicates and shows "Validation Issues" card', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    await uploadThroughAndReset(page, fixturePath)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).toBeVisible({ timeout: 20000 })
  })

  test('upload button count is 0 when all rows fail dry-run', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    await uploadThroughAndReset(page, fixturePath)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).toBeVisible({ timeout: 20000 })
    // dryRunValid = 0, dryRunEditedCount = 0 → "Upload 0 Transactions"
    await expect(page.getByRole('button', { name: /upload 0 transactions/i })).toBeVisible()
  })

  test('upload count increases by 1 when a dry-run failure row is edited', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    await uploadThroughAndReset(page, fixturePath)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).toBeVisible({ timeout: 20000 })

    // Expand and edit the first failure row's description
    const firstDesc = `Grocery Store Purchase ${suffix}`
    const panel = await expandRow(page, 0)
    await panel.locator('input').first().fill(`${firstDesc} EDITED`)

    // One row is now edited → dryRunEditedCount = 1 → "Upload 1 Transactions"
    await expect(page.getByRole('button', { name: /upload 1 transactions/i })).toBeVisible()
  })

  test('shows "passed server validation" green banner for a fresh unique file', async ({
    page,
  }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    // No seeding — rows are brand-new, dry-run should pass cleanly
    await setFileAndGoToPreview(page, fixturePath)
    await expect(page.getByText(/passed server validation/i)).toBeVisible({ timeout: 20000 })
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).not.toBeVisible()
  })
})

// =============================================================================
// Suite 2: Failed transactions grid — preview mode
// =============================================================================

test.describe('failed transactions grid — preview mode', () => {
  let testSuffix = ''
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    testSuffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(testSuffix)
    // Seed the rows so the second upload triggers dry-run duplicate failures
    await uploadThroughAndReset(page, fixturePath)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).toBeVisible({ timeout: 20000 })
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('expanding a row shows issue badges, Fix Required Fields, and Transaction Details', async ({
    page,
  }) => {
    const panel = await expandRow(page, 0)
    // Issue badges are visible
    await expect(panel.getByText(/duplicate/i).first()).toBeVisible()
    // Fix Required Fields section
    await expect(panel.getByText('Fix Required Fields')).toBeVisible()
    // Transaction Details section (read-only fields)
    await expect(panel.getByText('Transaction Details')).toBeVisible()
    // Existing Transaction section (duplicates show the conflicting row)
    await expect(panel.getByText('Existing Transaction')).toBeVisible()
  })

  test('editing description makes the row yellow (modified)', async ({ page }) => {
    const firstDesc = `Grocery Store Purchase ${testSuffix}`
    const panel = await expandRow(page, 0)
    await panel.locator('input').first().fill(`${firstDesc} EDITED`)
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
  })

  test('editing description increases the upload button count from 0 to 1', async ({ page }) => {
    const firstDesc = `Grocery Store Purchase ${testSuffix}`
    const panel = await expandRow(page, 0)
    await panel.locator('input').first().fill(`${firstDesc} EDITED`)
    await expect(page.getByRole('button', { name: /upload 1 transactions/i })).toBeVisible()
  })

  test('editing transaction date via date picker makes the row yellow (modified)', async ({
    page,
  }) => {
    const panel = await expandRow(page, 0)
    // Original date is 2024-01-15; change to 2024-01-16
    await pickDateInGrid(page, panel, 2024, 1, 16)
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
  })

  test('editing amount makes the row yellow (modified)', async ({ page }) => {
    const panel = await expandRow(page, 0)
    await panel.locator('input').last().fill('200')
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
  })

  test('editing a field back to its original value reverts the row to pending (no yellow)', async ({
    page,
  }) => {
    const firstDesc = `Grocery Store Purchase ${testSuffix}`
    const panel = await expandRow(page, 0)
    const descInput = panel.locator('input').first()
    // Edit to new value
    await descInput.fill(`${firstDesc} EDITED`)
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
    // Edit back to exact original — row should no longer be yellow
    await descInput.fill(firstDesc)
    await expect(summaryRow(page, 0)).not.toHaveClass(/bg-yellow-50/)
  })

  test('auto-fix appends "(2)" to the description and makes row yellow', async ({ page }) => {
    const firstDesc = `Grocery Store Purchase ${testSuffix}`
    const panel = await expandRow(page, 0)
    await panel.getByRole('button', { name: 'Auto-fix description' }).click()
    await expect(panel.locator('input').first()).toHaveValue(`${firstDesc} (2)`)
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
  })

  test('dismissing a row removes it from the grid', async ({ page }) => {
    await expect(
      page
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: /expand details|collapse details/i }) }),
    ).toHaveCount(3)
    await summaryRow(page, 0).getByRole('button', { name: 'Remove row' }).click()
    await expect(
      page
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: /expand details|collapse details/i }) }),
    ).toHaveCount(2, { timeout: 3000 })
  })

  test('edited duplicate uploads successfully and appears on manage page', async ({ page }) => {
    const firstDesc = `Grocery Store Purchase ${testSuffix}`
    const editedDesc = `${firstDesc} EDITED`

    // Expand and edit the first row's description so it is no longer a duplicate
    const panel = await expandRow(page, 0)
    await panel.locator('input').first().fill(editedDesc)

    // Upload the single edited row
    await expect(page.getByRole('button', { name: /upload 1 transactions/i })).toBeVisible()
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    // Only 1 row sent (the edited one); other 2 unedited duplicates are excluded from payload
    const statsGrid = page.locator('.grid.grid-cols-3.text-center')
    await expect(statsGrid.locator('.bg-green-50 .text-2xl')).toHaveText('1')

    // Verify transaction appears on the manage page with the edited description
    await page.goto('/dashboard/transactions/manage')
    await expect(page.getByRole('table')).toBeVisible()
    await page.getByRole('textbox', { name: /search/i }).fill(editedDesc)

    const uploadedRow = page.getByRole('row').filter({ hasText: editedDesc }).first()
    await expect(uploadedRow).toBeVisible({ timeout: 10000 })
    // Original date and amount unchanged
    await expect(uploadedRow.getByRole('cell', { name: displayDate('2024-01-15') })).toBeVisible()
  })
})

// =============================================================================
// Suite 3: Pagination in the failed transactions grid
// =============================================================================

test.describe('pagination in failed transactions grid', () => {
  let largeSuffix = ''
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    largeSuffix = uniqueSuffix()
    fixturePath = await buildLargeExcelFixture(largeSuffix, 30)
    // Seed 30 rows, then re-upload the same file so all 30 appear as dry-run duplicates
    await uploadThroughAndReset(page, fixturePath)
    await setFileAndGoToPreview(page, fixturePath)
    // 30 rows may take a little longer for the dry-run
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).toBeVisible({ timeout: 30000 })
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('page 1 shows first 25 rows; row 26 is not visible', async ({ page }) => {
    await expect(page.getByText(/showing 1.25 of 30/i)).toBeVisible()
    // Exactly 25 summary rows rendered on page 1
    await expect(
      page
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: /expand details|collapse details/i }) }),
    ).toHaveCount(25)
  })

  test('"Next page" button navigates to page 2 and shows rows 26–30', async ({ page }) => {
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText(/showing 26.30 of 30/i)).toBeVisible()
    // Only the remaining 5 summary rows on page 2
    await expect(
      page
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: /expand details|collapse details/i }) }),
    ).toHaveCount(5)
  })

  test('"Previous page" button returns to page 1', async ({ page }) => {
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText(/showing 26.30 of 30/i)).toBeVisible()
    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(page.getByText(/showing 1.25 of 30/i)).toBeVisible()
    // Back to 25 summary rows on page 1
    await expect(
      page
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: /expand details|collapse details/i }) }),
    ).toHaveCount(25)
  })
})

// =============================================================================
// Suite 4: Retry flow — COMPLETE mode
// =============================================================================

test.describe('retry flow — COMPLETE mode', () => {
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  /**
   * Build a mock failure record matching the first base row for a given suffix.
   * The mock transaction uses ISO date strings and a string amount, matching the
   * CSVTransaction type the client expects in the API response.
   */
  function buildMockFailure(suffix: string) {
    const base = getBaseRows(suffix)[0]
    return {
      row: 1,
      type: 'duplicate' as const,
      reason: 'Duplicate transaction exists in database',
      transaction: {
        account: base.account,
        user: base.user,
        transactionDate: '2024-01-15',
        postDate: '2024-01-17',
        description: base.description,
        category: base.category,
        type: base.type,
        amount: '125.5',
        memo: base.memo,
      },
      existingTransaction: {
        createdAt: new Date().toISOString(),
        account: base.account,
        amount: '125.5',
        description: base.description,
        transactionDate: '2024-01-15',
      },
    }
  }

  /**
   * Set up a route that intercepts the first POST to /api/transactions/bulk and
   * returns a canned 2-success / 1-failure response, then lets subsequent calls
   * through to the real server.
   */
  async function mockFirstUploadWithFailure(page: Page, suffix: string) {
    let callCount = 0
    await page.route(
      (url) => url.pathname === '/api/transactions/bulk',
      async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue()
          return
        }
        callCount++
        if (callCount === 1) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Upload completed with 1 failure',
              results: {
                total: 3,
                successful: 2,
                failed: 1,
                failures: [buildMockFailure(suffix)],
              },
            }),
          })
        } else {
          await route.continue()
        }
      },
    )
  }

  test('COMPLETE step shows "Failed Transactions" retry card when upload has failures', async ({
    page,
  }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    await mockFirstUploadWithFailure(page, suffix)

    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(
      page.getByRole('button', { name: /upload \d+ transactions/i }),
    ).toBeEnabled({ timeout: 15000 })
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })

    await expect(page.getByRole('heading', { name: /failed transactions/i })).toBeVisible()
  })

  test('"Retry row" removes the row from the retry grid after success', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    await mockFirstUploadWithFailure(page, suffix)

    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(
      page.getByRole('button', { name: /upload \d+ transactions/i }),
    ).toBeEnabled({ timeout: 15000 })
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })

    // Click retry on the single failed row; the row was never actually inserted (mock),
    // so the real server will accept it on retry.
    await page.getByRole('button', { name: 'Retry row' }).click()
    await expect(page.getByRole('button', { name: 'Retry row' })).not.toBeVisible({
      timeout: 10000,
    })
  })

  test('"Retry All" clears the retry grid and updates upload stats', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    await mockFirstUploadWithFailure(page, suffix)

    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(
      page.getByRole('button', { name: /upload \d+ transactions/i }),
    ).toBeEnabled({ timeout: 15000 })
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /retry all/i }).click()
    // Grid disappears once all rows succeed (visibleRows = 0 → component returns null)
    await expect(page.getByRole('button', { name: /retry all/i })).not.toBeVisible({
      timeout: 10000,
    })
    // onRetryComplete updates stats: successful 2→3, failed 1→0
    const statsGrid = page.locator('.grid.grid-cols-3.text-center')
    await expect(statsGrid.locator('.bg-green-50 .text-2xl')).toHaveText('3', { timeout: 5000 })
    await expect(statsGrid.locator('.bg-red-50 .text-2xl')).toHaveText('0')
  })

  test('no retry grid shown when all rows upload successfully', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)

    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(
      page.getByRole('button', { name: /upload \d+ transactions/i }),
    ).toBeEnabled({ timeout: 15000 })
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })
    await assertUploadStats(page, { total: 3, successful: 3, failed: 0 })
    await expect(page.getByRole('heading', { name: /failed transactions/i })).not.toBeVisible()
  })
})

// =============================================================================
// Suite 5: Wizard navigation
// =============================================================================

test.describe('wizard navigation', () => {
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('"Back to Mapping" from PREVIEW returns to the column mapping step', async ({ page }) => {
    fixturePath = buildSmallCsvFixture(uniqueSuffix())
    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(page.getByRole('heading', { name: /preview data/i })).toBeVisible()

    await page.getByRole('button', { name: /back to mapping/i }).click()

    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    // Column mapping dropdowns are still present (state preserved)
    await expect(page.getByRole('button', { name: /continue to preview/i })).toBeVisible()
  })

  test('"Upload Another File" from COMPLETE resets wizard to the upload step', async ({
    page,
  }) => {
    fixturePath = buildSmallCsvFixture(uniqueSuffix())
    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(
      page.getByRole('button', { name: /upload \d+ transactions/i }),
    ).toBeEnabled({ timeout: 15000 })
    await page.getByRole('button', { name: /upload \d+ transactions/i }).click()
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /upload another file/i }).click()

    await expect(page.getByRole('heading', { name: /upload transactions/i, level: 1 })).toBeVisible()
    // Drag-drop zone and file input should be present (state reset)
    await expect(page.locator('input[type="file"]')).toBeAttached()
  })

  test('"Back" in MAPPING returns to the upload step', async ({ page }) => {
    fixturePath = buildSmallCsvFixture(uniqueSuffix())
    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()

    await page.getByRole('button', { name: /^back$/i }).click()

    await expect(page.getByRole('heading', { name: /upload transactions/i, level: 1 })).toBeVisible()
    await expect(page.locator('input[type="file"]')).toBeAttached()
  })
})

// =============================================================================
// Fixture builders for validation-type tests
// =============================================================================

/**
 * Build a CSV where every row uses valid format but references entities that
 * do NOT exist in the E2E household. This triggers client-side entity validation.
 *
 * E2E household has: Account "E2E Checking", User "E2E User",
 * Categories: Groceries/Bills & Utilities/Food & Drink/Shopping/Entertainment/Paycheck,
 * Types: Sale/Income/Return.
 */
function buildEntityErrorCsvFixture(suffix: string): string {
  const header = 'Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo'
  const lines = [
    // Row 1: unknown account, unknown category, unknown type
    `Nonexistent Bank,E2E User,01/15/2024,01/15/2024,Entity test 1 ${suffix},Fake Category,Fake Type,50.00,bad entities`,
    // Row 2: unknown user (account/category/type are valid)
    `E2E Checking,Nobody,01/16/2024,01/16/2024,Entity test 2 ${suffix},Groceries,Sale,25.00,bad user`,
    // Row 3: all entities unknown
    `Bad Account,Ghost User,01/17/2024,01/17/2024,Entity test 3 ${suffix},Nonexistent Cat,Bogus Type,75.00,all bad`,
  ]
  const content = [header, ...lines].join('\n')
  const tmpPath = path.join(os.tmpdir(), `e2e-entity-err-${Date.now()}-${suffix}.csv`)
  fs.writeFileSync(tmpPath, content)
  return tmpPath
}

/**
 * Build a CSV with format validation errors: missing fields and bad formats.
 */
function buildFormatErrorCsvFixture(suffix: string): string {
  const header = 'Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo'
  const lines = [
    // Row 1: missing account + missing date
    `,E2E User,,01/15/2024,Format test 1 ${suffix},Groceries,Sale,50.00,missing account and date`,
    // Row 2: invalid date + non-numeric amount
    `E2E Checking,E2E User,not-a-date,01/16/2024,Format test 2 ${suffix},Groceries,Sale,abc,bad date and amount`,
    // Row 3: missing description
    `E2E Checking,E2E User,01/17/2024,01/17/2024,,Groceries,Sale,30.00,missing description`,
  ]
  const content = [header, ...lines].join('\n')
  const tmpPath = path.join(os.tmpdir(), `e2e-format-err-${Date.now()}-${suffix}.csv`)
  fs.writeFileSync(tmpPath, content)
  return tmpPath
}

/**
 * Build a CSV with both format AND entity issues on the same row.
 */
function buildMixedErrorCsvFixture(suffix: string): string {
  const header = 'Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo'
  const lines = [
    // Row 1: missing date (format) + unknown category (entity) + unknown type (entity)
    `E2E Checking,E2E User,,01/15/2024,Mixed test 1 ${suffix},Fake Category,Fake Type,50.00,mixed errors`,
    // Row 2: missing amount (format) + unknown account (entity)
    `Bad Account,E2E User,01/16/2024,01/16/2024,Mixed test 2 ${suffix},Groceries,Sale,,mixed errors 2`,
  ]
  const content = [header, ...lines].join('\n')
  const tmpPath = path.join(os.tmpdir(), `e2e-mixed-err-${Date.now()}-${suffix}.csv`)
  fs.writeFileSync(tmpPath, content)
  return tmpPath
}

// =============================================================================
// Suite 6: Expansion panel — entity validation errors
// =============================================================================

test.describe('expansion panel — entity validation errors', () => {
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('entity issue badges render as destructive badges', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildEntityErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    const panel = await expandRow(page, 0)
    // Row 1 has: unknown account, unknown category, unknown type
    await expect(panel.getByText(/account "nonexistent bank" is not defined/i)).toBeVisible()
    await expect(panel.getByText(/category "fake category" is not defined/i)).toBeVisible()
    await expect(panel.getByText(/type "fake type" is not defined/i)).toBeVisible()
  })

  test('entity issues render Select dropdowns for account, category, type, and user', async ({
    page,
  }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildEntityErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Row 1 has account, category, type entity errors → all should be Select
    const panel1 = await expandRow(page, 0)
    await expect(panel1.getByText('Select account…')).toBeVisible()
    await expect(panel1.getByText('Select category…')).toBeVisible()
    await expect(panel1.getByText('Select type…')).toBeVisible()

    // Collapse row 1 and expand row 2 (has user entity error)
    await page.getByRole('button', { name: 'Collapse details' }).click()
    const panel2 = await expandRow(page, 1)
    await expect(panel2.getByText('Select user…')).toBeVisible()
  })

  test('selecting a category from dropdown makes the row modified (yellow)', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildEntityErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    const panel = await expandRow(page, 0)
    // Click the category select trigger
    await panel.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select category…' }).click()
    // Pick a valid category
    await page.getByRole('option', { name: 'Groceries' }).click()
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
  })

  test('selecting a type from dropdown makes the row modified (yellow)', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildEntityErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    const panel = await expandRow(page, 0)
    await panel.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select type…' }).click()
    await page.getByRole('option', { name: 'Sale' }).click()
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
  })

  test('selecting a user from dropdown makes the row modified (yellow)', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildEntityErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Row 2 has the user entity error
    const panel = await expandRow(page, 1)
    await panel.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select user…' }).click()
    await page.getByRole('option', { name: 'E2E User' }).click()
    await expect(summaryRow(page, 1)).toHaveClass(/bg-yellow-50/)
  })

  test('selecting an account from dropdown makes the row modified (yellow)', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildEntityErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    const panel = await expandRow(page, 0)
    await panel.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select account…' }).click()
    await page.getByRole('option', { name: 'E2E Checking' }).click()
    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
  })
})

// =============================================================================
// Suite 7: Expansion panel — format validation errors
// =============================================================================

test.describe('expansion panel — format validation errors', () => {
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('format issue badges render with correct messages', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildFormatErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Row 1: missing account + missing date
    const panel = await expandRow(page, 0)
    await expect(panel.getByText('Account is required')).toBeVisible()
    await expect(panel.getByText('Transaction date is required')).toBeVisible()
  })

  test('format issues show date picker for transaction date and text input for description', async ({
    page,
  }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildFormatErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Row 1: missing date → date picker; missing account → Select (accounts are always Select)
    const panel1 = await expandRow(page, 0)
    // Date picker trigger (popover-trigger with calendar icon)
    await expect(panel1.locator('[data-slot="popover-trigger"]')).toBeVisible()
    // Account field renders as Select (accounts are predefined)
    await expect(panel1.getByText('Select account…')).toBeVisible()

    // Row 3: missing description → text input
    await page.getByRole('button', { name: 'Collapse details' }).click()
    const panel3 = await expandRow(page, 2)
    await expect(panel3.getByText('Description is required')).toBeVisible()
    await expect(panel3.locator('input[type="text"], input:not([type])')).toBeVisible()
  })

  test('non-affected fields display as read-only in Transaction Details', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildFormatErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Row 1 has account + date issues, so description/amount/category/type should be read-only
    const panel = await expandRow(page, 0)
    const detailsSection = panel.getByText('Transaction Details').locator('..')
    await expect(detailsSection.getByText(`Format test 1 ${suffix}`)).toBeVisible()
    await expect(detailsSection.getByText('$50.00')).toBeVisible()
    await expect(detailsSection.getByText('Groceries')).toBeVisible()
    await expect(detailsSection.getByText('Sale')).toBeVisible()
  })
})

// =============================================================================
// Suite 8: Expansion panel — mixed validation (format + entity)
// =============================================================================

test.describe('expansion panel — mixed validation (format + entity)', () => {
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('row with format issues shows date picker and entity values as read-only', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildMixedErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Row 1: missing date (format) — always caught regardless of entity loading
    const panel = await expandRow(page, 0)
    // Date picker for format date error
    await expect(panel.locator('[data-slot="popover-trigger"]')).toBeVisible()
    // Format badge visible
    await expect(panel.getByText('Transaction date is required')).toBeVisible()
    // Entity-invalid values appear somewhere in the panel (read-only or editable
    // depending on whether entities loaded before validation ran)
    await expect(panel.getByText('Fake Category')).toBeVisible()
    await expect(panel.getByText('Fake Type')).toBeVisible()
  })

  test('editing the date on a mixed-issue row marks it modified', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildMixedErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    const panel = await expandRow(page, 0)

    // Fix date via date picker
    await pickDateInGrid(page, panel, 2024, 1, 20)

    await expect(summaryRow(page, 0)).toHaveClass(/bg-yellow-50/)
    // Upload button should count at least 1 edited row
    await expect(page.getByRole('button', { name: /upload [1-9]\d* transactions/i })).toBeVisible()
  })
})

// =============================================================================
// Suite 9: Expansion panel — duplicate details & misc
// =============================================================================

test.describe('expansion panel — duplicate details and misc', () => {
  let fixturePath: string | undefined

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/upload')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test.afterEach(() => cleanupTempFile(fixturePath))

  test('duplicate row shows Existing Transaction section with matching details', async ({
    page,
  }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    // Seed the rows so re-upload triggers duplicates
    await uploadThroughAndReset(page, fixturePath)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).toBeVisible({ timeout: 20000 })

    const panel = await expandRow(page, 0)
    await expect(panel.getByText('Existing Transaction')).toBeVisible()
    // The existing transaction section shows the original description
    await expect(panel.getByText(`Grocery Store Purchase ${suffix}`).first()).toBeVisible()
  })

  test('removing all rows individually clears the grid', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildSmallCsvFixture(suffix)
    await uploadThroughAndReset(page, fixturePath)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation issues/i }),
    ).toBeVisible({ timeout: 20000 })

    // Verify rows exist first
    await expect(
      page
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: /expand details/i }) }),
    ).toHaveCount(3)

    // Remove each row individually (preview mode has no "Dismiss All" button)
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /remove row/i }).first().click()
    }

    // Grid should be empty — no more summary rows
    await expect(
      page.getByRole('button', { name: /expand details/i }),
    ).toHaveCount(0, { timeout: 3000 })
  })

  test('"Fix required" badge visible on collapsed row with unresolved issues', async ({
    page,
  }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildEntityErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Rows are collapsed by default — "Fix required" badge should be visible
    await expect(summaryRow(page, 0).getByText('Fix required')).toBeVisible()
  })

  test('destructive border on field clears after editing', async ({ page }) => {
    const suffix = uniqueSuffix()
    fixturePath = buildFormatErrorCsvFixture(suffix)
    await setFileAndGoToPreview(page, fixturePath)
    await expect(
      page.getByRole('heading', { name: /validation/i }),
    ).toBeVisible({ timeout: 15000 })

    // Row 3: missing description → input has destructive border (dynamic class, not the Tailwind aria-invalid: prefix)
    const panel = await expandRow(page, 2)
    const descInput = panel.locator('input').first()
    await expect(descInput).toHaveClass(/(?<!:)border-destructive/)
    // Fill in a description — destructive border should clear
    await descInput.fill('Fixed description')
    await expect(descInput).not.toHaveClass(/(?<!:)border-destructive/)
  })
})
