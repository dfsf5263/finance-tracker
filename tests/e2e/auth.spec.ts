import { test, expect } from './fixtures'

test.describe('auth flows', () => {
  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('redirects to sign-in when accessing dashboard unauthenticated', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 })
    })

    test('sign up redirects to dashboard when email verification is disabled', { tag: '@no-email' }, async ({ page }) => {
      const uniqueEmail = `signup-test-${Date.now()}@test.local`

      await page.goto('/sign-up')
      await page.getByLabel('First name').fill('Test')
      await page.getByLabel('Last name').fill('User')
      await page.getByLabel('Email').fill(uniqueEmail)
      await page.getByLabel('Password').fill('TestPassword123!')
      await page.getByRole('button', { name: /sign up|create account/i }).click()

      // Should go straight to dashboard, not /verify-email-sent
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
      // A new user has no household — the creation dialog is the expected post-signup state
      await expect(page.getByRole('dialog', { name: /create your first household/i })).toBeVisible({ timeout: 10000 })
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
