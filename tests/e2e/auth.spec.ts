import { test, expect } from './fixtures'

test.describe('auth flows', () => {
  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('redirects to sign-in when accessing dashboard unauthenticated', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 })
    })
  })

  test('can sign out and sign back in', async ({ page, context }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('main')).toBeVisible()

    // Sign out via user dropdown
    await page.getByRole('button', { name: /e2e@test\.local/i }).click()
    await page.getByRole('menuitem', { name: /log out/i }).click()
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 })

    // Sign back in — wait for the form to be fully interactive after sign-out navigation
    const signInBtn = page.getByRole('button', { name: /sign in/i })
    await signInBtn.waitFor({ state: 'visible' })
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(process.env.E2E_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!)
    await signInBtn.click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })
    await expect(page.getByRole('main')).toBeVisible()

    // Persist renewed session so any later tests still work
    await context.storageState({ path: 'tests/e2e/.auth/user.json' })
  })

  test.describe('forgot password', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('forgot password page accepts email submission', async ({ page }) => {
      await page.goto('/forgot-password')
      await page.getByLabel(/email/i).fill('test@example.com')
      await page.getByRole('button', { name: /send|reset/i }).click()
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 })
    })
  })
})
