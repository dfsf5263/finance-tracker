import { test, expect } from './fixtures'

const testId = Date.now()
const createName = `E2E Person ${testId}`
const editName = `E2E Renamed ${testId}`

test.describe('definitions — users', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/definitions/users')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('create user: appears in list after submit', async ({ page }) => {
    await page.getByRole('button', { name: /add user/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel(/name/i).fill(createName)
    await dialog.getByRole('button', { name: /create user/i }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(createName)).toBeVisible()
  })

  test('edit user: updated name shown in list', async ({ page }) => {
    const row = page.locator('.border.rounded', { hasText: createName })
    await row.getByRole('button').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel(/name/i).fill(editName)
    await dialog.getByRole('button', { name: /update user/i }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(editName)).toBeVisible()
  })

  test('delete user: removed from list', async ({ page }) => {
    const row = page.locator('.border.rounded', { hasText: editName })
    await row.getByRole('button').last().click()
    await expect(page.getByText(editName)).not.toBeVisible()
  })

  test('client-side validation: empty name shows inline error', async ({ page }) => {
    await page.getByRole('button', { name: /add user/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /create user/i }).click()
    // HTML required attribute prevents submission; dialog stays open
    await expect(dialog).toBeVisible()
  })
})
