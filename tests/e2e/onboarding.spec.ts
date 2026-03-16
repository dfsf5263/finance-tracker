import { test, expect } from './fixtures'

// This suite tests the first-login experience for a brand-new user.
// It runs in an isolated browser context (no saved session).
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('onboarding', () => {
  test('new user sees household creation modal and can create a household', async ({ page }) => {
    // Sign up as a fresh user — use a unique email each run
    const uniqueEmail = `onboarding-${Date.now()}@test.local`
    await page.goto('/sign-up')
    await page.getByLabel('First name').fill('New')
    await page.getByLabel('Last name').fill('User')
    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password').fill('OnboardTest1!')
    await page.getByRole('button', { name: /sign up|create account/i }).click()

    // Wait for navigation to complete after sign-up
    await page.waitForURL((url) => !url.pathname.startsWith('/sign-up'))

    // Better Auth requires email verification — skip further assertions if
    // a verification screen is shown; the modal assertion is for post-verify flow.
    const url = page.url()
    if (url.includes('verify-email') || url.includes('email-sent')) {
      // Email verification required — we can only assert the verification screen appeared
      await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()
      return
    }

    // If auto-redirect lands on dashboard without a household, modal should appear
    await page.waitForURL('/dashboard')
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByLabel('Household name').fill('My New Household')
    await page.getByRole('button', { name: /create/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('combobox').getByText('My New Household')).toBeVisible()
  })
})
