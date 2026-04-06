import { test, expect } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

/** Find the E2E Test Household ID using an authenticated API request context. */
async function getTestHouseholdId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/households')
  expect(res.ok()).toBe(true)
  const households = (await res.json()) as { id: string; name: string }[]
  const hh = households.find((h) => h.name === 'E2E Test Household')
  expect(hh).toBeTruthy()
  return hh!.id
}

/** Create a PENDING invitation via the API and return its token. Retries on transient errors. */
async function createInvitation(
  request: APIRequestContext,
  householdId: string,
  email: string,
): Promise<string> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await request.post(`/api/households/${householdId}/invitations`, {
        data: { role: 'MEMBER', inviteeEmail: email, expiresInDays: 7 },
      })
      expect(res.ok()).toBe(true)
      const invitation = (await res.json()) as { token: string }
      return invitation.token
    } catch (error) {
      lastError = error as Error
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw lastError!
}

/** Delete PENDING invitations created by this spec (invite-* prefix). */
async function cleanupTestInvitations(request: APIRequestContext) {
  const householdsRes = await request.get('/api/households')
  if (!householdsRes.ok()) return
  const households = (await householdsRes.json()) as { id: string; name: string }[]
  const hh = households.find((h) => h.name === 'E2E Test Household')
  if (!hh) return

  const invitationsRes = await request.get(`/api/households/${hh.id}/invitations`)
  if (!invitationsRes.ok()) return
  const invitations = (await invitationsRes.json()) as {
    id: string
    inviteeEmail: string
    status: string
  }[]

  for (const inv of invitations) {
    if (inv.inviteeEmail?.startsWith('invite-') && inv.status === 'PENDING') {
      await request.delete(`/api/invitations/by-id/${inv.id}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Unauthenticated flows — fresh browser context, no session
// ---------------------------------------------------------------------------
test.describe('invitation redirect — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  // Serialize: tests share householdId via beforeAll — parallel workers would
  // each re-run beforeAll cleanup and delete each other's invitations.
  test.describe.configure({ mode: 'serial' })

  // We need an authenticated request context to create invitations via API.
  // Playwright lets us create one from the saved storage state.
  let householdId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' })
    const req = ctx.request
    householdId = await getTestHouseholdId(req)
    await cleanupTestInvitations(req)
    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' })
    await cleanupTestInvitations(ctx.request)
    await ctx.close()
  })

  test('new user accepts invitation without email verification', { tag: '@no-email' }, async ({ browser }) => {
    // Create invitation from an authenticated context
    const authCtx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' })
    const inviteeEmail = `invite-new-${Date.now()}@test.local`
    const token = await createInvitation(authCtx.request, householdId, inviteeEmail)
    await authCtx.close()

    // Open invitation page in a fresh unauthenticated context
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`/invitations/${token}`)

    // Should see invitation details without being signed in
    await expect(page.getByRole('heading', { name: /join/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/sign in to accept this invitation/i)).toBeVisible()

    // Click "Sign In to Join" — should include redirect param
    await page.getByRole('button', { name: /sign in to join/i }).click()
    await expect(page).toHaveURL(/\/sign-in.*redirect=/, { timeout: 10000 })

    // Navigate to sign-up — redirect param should be preserved
    await page.getByRole('link', { name: /sign up/i }).click()
    await expect(page).toHaveURL(/\/sign-up.*redirect=/, { timeout: 10000 })

    // Fill sign-up form
    await page.getByLabel('First name').fill('Invited')
    await page.getByLabel('Last name').fill('User')
    await page.getByLabel('Email').fill(inviteeEmail)
    await page.getByLabel('Password').fill('InviteTest1!')
    await page.getByRole('button', { name: /sign up|create account/i }).click()

    // Should redirect to invitation page, not /dashboard
    await expect(page).toHaveURL(new RegExp(`/invitations/${token}`), { timeout: 15000 })

    // Accept the invitation
    await page.getByRole('button', { name: /accept invitation/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

    await ctx.close()
  })

  test('new user sign-up with email preserves redirect through verify-email-sent', async ({
    browser,
  }) => {
    const authCtx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' })
    const inviteeEmail = `invite-email-${Date.now()}@test.local`
    const token = await createInvitation(authCtx.request, householdId, inviteeEmail)
    await authCtx.close()

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`/invitations/${token}`)

    await page.getByRole('button', { name: /sign in to join/i }).click()
    await page.getByRole('link', { name: /sign up/i }).click()

    await page.getByLabel('First name').fill('EmailInv')
    await page.getByLabel('Last name').fill('User')
    await page.getByLabel('Email').fill(inviteeEmail)
    await page.getByLabel('Password').fill('InviteTest1!')
    await page.getByRole('button', { name: /sign up|create account/i }).click()

    // Should land on verify-email-sent with the redirect param preserved
    await expect(page).toHaveURL(/\/verify-email-sent.*redirect=/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()

    // "Back to sign in" link should include redirect
    const backLink = page.getByRole('link', { name: /back to sign in/i })
    await expect(backLink).toBeVisible()
    const href = await backLink.getAttribute('href')
    expect(href).toContain('redirect=')
    expect(href).toContain(encodeURIComponent(`/invitations/${token}`))

    await ctx.close()
  })

  test('existing user signs in and is redirected to invitation', async ({ browser }) => {
    const authCtx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' })
    const inviteeEmail = `invite-exist-${Date.now()}@test.local`
    const token = await createInvitation(authCtx.request, householdId, inviteeEmail)
    await authCtx.close()

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`/invitations/${token}`)

    await page.getByRole('button', { name: /sign in to join/i }).click()
    await expect(page).toHaveURL(/\/sign-in.*redirect=/, { timeout: 10000 })

    // Sign in with the seeded E2E user
    await page.getByLabel('Email').fill(process.env.E2E_EMAIL || 'e2e@test.local')
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD || 'E2eTestPassword1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should redirect to the invitation page, not /dashboard
    await expect(page).toHaveURL(new RegExp(`/invitations/${token}`), { timeout: 15000 })

    // Verify the invitation page loaded correctly (the E2E user is already a household
    // member so we can't actually accept — we just verify the redirect landed here)
    await expect(page.getByRole('button', { name: /accept invitation/i })).toBeVisible()

    await ctx.close()
  })

  test.fixme(
    'existing user with 2FA is redirected to invitation after TOTP',
    async () => {
      // Requires a seeded user with TOTP 2FA enabled and a TOTP secret available
      // in environment variables to generate valid codes. Implement when 2FA test
      // infrastructure is available.
    },
  )
})

// ---------------------------------------------------------------------------
// Middleware redirect preservation
// ---------------------------------------------------------------------------
test.describe('middleware redirect preservation', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('deep link is preserved through sign-in', async ({ page }) => {
    await page.goto('/dashboard/settings/profile')

    // Middleware should redirect to sign-in with the original URL
    await expect(page).toHaveURL(/\/sign-in.*redirect=.*settings.*profile/, { timeout: 15000 })

    // Sign in
    await page.getByLabel('Email').fill(process.env.E2E_EMAIL || 'e2e@test.local')
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD || 'E2eTestPassword1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should land on the originally requested page
    await expect(page).toHaveURL(/\/dashboard\/settings\/profile/, { timeout: 15000 })
  })

  test('open redirect to external URL is blocked', async ({ page }) => {
    await page.goto('/sign-in?redirect=https://evil.com')

    await page.getByLabel('Email').fill(process.env.E2E_EMAIL || 'e2e@test.local')
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD || 'E2eTestPassword1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should go to /dashboard, NOT to evil.com
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    expect(page.url()).not.toContain('evil.com')
  })

  test('protocol-relative redirect is blocked', async ({ page }) => {
    await page.goto('/sign-in?redirect=//evil.com')

    await page.getByLabel('Email').fill(process.env.E2E_EMAIL || 'e2e@test.local')
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD || 'E2eTestPassword1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    expect(page.url()).not.toContain('evil.com')
  })
})
