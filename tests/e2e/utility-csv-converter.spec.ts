import { test, expect } from './fixtures'
import path from 'path'

const FIXTURES = path.resolve(__dirname, '../../test')

test.describe('CSV Converter utility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/utility/csv-converter')
    await expect(page.getByRole('main')).toBeVisible()
  })

  // ── Page render & navigation ──────────────────────────────

  test('page loads and shows correct header title', async ({ page }) => {
    await expect(page.getByText('Utility - CSV Converter')).toBeVisible()
  })

  test('sidebar CSV Converter link is active', async ({ page }) => {
    const link = page.getByRole('link', { name: 'CSV Converter', exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('data-active', 'true')
  })

  // ── UI state — no inputs ──────────────────────────────────

  test('convert button is disabled initially', async ({ page }) => {
    const btn = page.getByRole('button', { name: /convert & download excel/i })
    await expect(btn).toBeDisabled()
  })

  test('convert button disabled with file but no institution', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'fidelity-sample.csv'))
    await expect(page.getByRole('button', { name: /convert & download excel/i })).toBeDisabled()
  })

  test('convert button disabled with institution but no file', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Fidelity' }).click()
    await expect(page.getByRole('button', { name: /convert & download excel/i })).toBeDisabled()
  })

  test('convert button enabled when institution and file both provided', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Fidelity' }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'fidelity-sample.csv'))
    await expect(page.getByRole('button', { name: /convert & download excel/i })).toBeEnabled()
  })

  test('file name displayed after attachment', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'fidelity-sample.csv'))
    await expect(page.getByText('fidelity-sample.csv')).toBeVisible()
  })

  // ── Instructions & dropdowns ──────────────────────────────

  test('instructions section is visible', async ({ page }) => {
    await expect(page.getByText('How to Use This Converter')).toBeVisible()
  })

  test('all three institutions are in the dropdown', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await expect(page.getByRole('option', { name: 'Fidelity' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'American Express' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Chase' })).toBeVisible()
  })

  // ── Successful conversions ────────────────────────────────

  test('fidelity CSV triggers xlsx download', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Fidelity' }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'fidelity-sample.csv'))

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /convert & download excel/i }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/finance-tracker-import-fidelity-.*\.xlsx/)
  })

  test('amex CSV triggers xlsx download', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'American Express' }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'amex-sample.csv'))

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /convert & download excel/i }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/finance-tracker-import-american-express-.*\.xlsx/)
  })

  test('chase CSV triggers xlsx download', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Chase' }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'chase-sample.csv'))

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /convert & download excel/i }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/finance-tracker-import-chase-.*\.xlsx/)
  })

  test('success toast shown after conversion', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Fidelity' }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'fidelity-sample.csv'))

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /convert & download excel/i }).click()
    await downloadPromise

    await expect(page.getByText(/converted \d+ transactions to excel/i)).toBeVisible({
      timeout: 10000,
    })
  })

  // ── Error handling ────────────────────────────────────────

  test('wrong headers CSV shows error toast', async ({ page }) => {
    await page.locator('main').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Fidelity' }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'csv-converter-bad-headers.csv'))

    await page.getByRole('button', { name: /convert & download excel/i }).click()

    await expect(page.getByText(/missing expected columns/i)).toBeVisible({ timeout: 10000 })
  })
})
