import { test, expect } from './fixtures'

// Unique suffix shared across dependent add → edit → delete tests
const testId = Date.now()
const addDesc = `E2E Purchase ${testId}`

test.describe('transaction management', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions/manage')
    await expect(page.getByRole('main')).toBeVisible()
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
})
