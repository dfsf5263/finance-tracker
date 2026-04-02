import { test, expect } from './fixtures'

test.describe('developer — API keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/api-keys')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('page loads with API keys manager', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'API Keys', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /create api key/i })).toBeVisible()
  })

  test('can generate a key and use it for authenticated API requests', async ({
    page,
    playwright,
  }) => {
    const keyName = `E2E Test Key ${test.info().workerIndex}-${Date.now()}`

    // Open create dialog
    await page.getByRole('button', { name: /create api key/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Create API Key' })).toBeVisible()

    // Fill in name and submit
    await dialog.getByLabel('Name').fill(keyName)
    await dialog.getByRole('button', { name: 'Create API Key' }).click()

    // Key is revealed — shown once
    await expect(dialog.getByRole('heading', { name: 'API Key Created' })).toBeVisible()
    const keyCode = dialog.locator('code')
    await expect(keyCode).toBeVisible()
    const keyValue = (await keyCode.textContent()) ?? ''
    expect(keyValue).toMatch(/^ft_/)

    // Dismiss the dialog
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(dialog).not.toBeVisible()

    // Key appears in the table by name
    await expect(page.getByRole('cell', { name: keyName, exact: true })).toBeVisible()

    // --- Verify the key authenticates API requests ---
    // Create a fresh context with no session cookie to confirm the
    // key alone is sufficient for authentication.
    const apiCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
      storageState: undefined,
      extraHTTPHeaders: { 'x-api-key': keyValue },
    })
    try {
      const response = await apiCtx.get('/api/households')
      expect(response.status()).toBe(200)
      const body = await response.json()
      expect(Array.isArray(body)).toBe(true)
    } finally {
      await apiCtx.dispose()
    }

    // --- Clean up: delete the test key ---
    const testKeyRow = page.getByRole('row', { name: new RegExp(keyName) })
    await testKeyRow.getByRole('button').click()
    await expect(page.getByRole('cell', { name: keyName, exact: true })).not.toBeVisible()
  })
})
