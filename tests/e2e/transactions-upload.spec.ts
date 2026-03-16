import { test, expect } from './fixtures'
import path from 'path'

const FIXTURES = path.resolve(__dirname, '../../test')

test.describe('CSV bulk upload', () => {
  test.beforeEach(async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: /upload complete/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Successful', { exact: true })).toBeVisible()
  })

  test('uploads CSV with row errors and shows error table', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample-transactions-errors.csv'))

    // Proceed through mapping to preview where validation errors surface
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()

    // Validation errors or upload failures should appear
    await expect(page.getByRole('heading', { name: /validation errors/i })).toBeVisible({ timeout: 15000 })
  })

  test('uploads CSV with different headers and surfaces mapping UI', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample-transactions-different-headers.csv'))
    // Column mapping step should appear
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible({ timeout: 10000 })
  })

  test('client-side validation errors shown in preview step', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.join(FIXTURES, 'sample-transactions-client-validation-errors.csv')
    )
    // Mapping step appears; proceed to preview to trigger client validation
    await expect(page.getByRole('heading', { name: /map columns/i })).toBeVisible()
    await page.getByRole('button', { name: /continue to preview/i }).click()
    await expect(page.getByRole('heading', { name: /validation errors/i })).toBeVisible({ timeout: 10000 })
  })
})
