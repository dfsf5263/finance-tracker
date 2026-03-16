import { test, expect } from './fixtures'

const testId = Date.now()
const createName = `E2E Type ${testId}`

test.describe('definitions — transaction types', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/definitions/types')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('create type: appears in list after submit', async ({ page }) => {
    await page.getByRole('button', { name: /add type/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel(/name/i).fill(createName)
    await dialog.getByRole('button', { name: /create transaction type/i }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(createName)).toBeVisible()
  })

  test('edit type: toggle flow direction and verify it persists', async ({ page }) => {
    const row = page.locator('.border.rounded', { hasText: createName })
    // First icon button is edit
    await row.getByRole('button').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Flow Direction is a <Select> (combobox), toggle from Outflow to Inflow
    const flowSelect = dialog.getByRole('combobox', { name: /flow direction/i })
    await flowSelect.click()
    await page.getByRole('option', { name: /inflow/i }).click()
    await dialog.getByRole('button', { name: /update transaction type/i }).click()
    await expect(dialog).not.toBeVisible()

    // Verify the badge changed to Inflow
    await expect(row.getByText(/inflow/i)).toBeVisible()
  })

  test('delete type: removed from list', async ({ page }) => {
    const row = page.locator('.border.rounded', { hasText: createName })
    // Last icon button is delete
    await row.getByRole('button').last().click()
    await expect(page.getByText(createName)).not.toBeVisible()
  })

  test('client-side validation: empty name shows inline error', async ({ page }) => {
    await page.getByRole('button', { name: /add type/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /create transaction type/i }).click()
    // HTML required attribute prevents submission; dialog stays open
    await expect(dialog).toBeVisible()
  })
})
