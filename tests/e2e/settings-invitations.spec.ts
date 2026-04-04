import { test, expect } from './fixtures'
import type { APIRequestContext, Locator } from '@playwright/test'

/** Delete all PENDING @test.local invitations left over from previous runs. */
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
    if (inv.inviteeEmail?.endsWith('@test.local') && inv.status === 'PENDING') {
      await request.delete(`/api/invitations/by-id/${inv.id}`)
    }
  }
}

/**
 * Wait for the invitation count in the h4 heading to stabilise across
 * two consecutive reads, surviving cache → fresh-data transitions.
 */
async function waitForStableCount(heading: Locator, minCount = 1): Promise<number> {
  let prevCount = -1
  let currCount = -1
  await expect(async () => {
    prevCount = currCount
    const text = await heading.textContent()
    currCount = Number(text?.match(/\((\d+)\)/)?.[1] ?? -1)
    expect(currCount).toBeGreaterThanOrEqual(minCount)
    expect(currCount).toBe(prevCount)
  }).toPass({ timeout: 10000, intervals: [500, 500, 1000, 1000] })
  return currCount
}

/** Matches formatted date-times like "March 27, 2026 at 3:45 PM". */
const DATE_TIME_PATTERN = /\w+ \d{1,2}, \d{4} at \d{1,2}:\d{2}\s[AP]M/

test.describe('settings — household invitations', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestInvitations(page.request)
    await page.goto('/dashboard/settings/household?tab=invitations')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('invitations tab content is visible', async ({ page }) => {
    await expect(page.getByRole('tabpanel')).toBeVisible()
  })

  test('send invitation: appears in pending list', async ({ page }) => {
    const tabpanel = page.getByRole('tabpanel')
    const inviteeEmail = `invited-${Date.now()}@test.local`

    await page.getByRole('button', { name: /invite member/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel(/email/i).fill(inviteeEmail)
    await dialog.getByRole('button', { name: /create invitation/i }).click()

    // Capture the created invitation URL and verify that exact invitation appears in the list.
    await expect(dialog.getByRole('heading', { name: /invitation created/i })).toBeVisible({ timeout: 10000 })
    const invitationLink = await dialog.getByRole('textbox').inputValue()
    await dialog.getByRole('button', { name: /done/i }).click()
    await expect(dialog).not.toBeVisible()

    await expect(tabpanel.getByText(invitationLink, { exact: true })).toBeVisible({ timeout: 10000 })

    // Verify the expiry date+time is displayed in a recognisable format
    await expect(tabpanel.getByText(DATE_TIME_PATTERN).first()).toBeVisible()
  })

  test('cancel invitation: removed from list', async ({ page }) => {
    const tabpanel = page.getByRole('tabpanel')
    const countHeading = tabpanel.getByRole('heading', { level: 4 })

    // Wait for heading count to stabilise (may start at 0)
    await waitForStableCount(countHeading, 0)

    // Create an invitation to cancel
    await page.getByRole('button', { name: /invite member/i }).click()
    const createDialog = page.getByRole('dialog')
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel(/email/i).fill('cancel-e2e@test.local')
    await createDialog.getByRole('button', { name: /create invitation/i }).click()
    await expect(createDialog.getByRole('heading', { name: /invitation created/i })).toBeVisible({ timeout: 10000 })
    await createDialog.getByRole('button', { name: /done/i }).click()
    await expect(createDialog).not.toBeVisible()

    // Wait for the list to refresh after creation, then read stable count
    const afterCreateCount = await waitForStableCount(countHeading)

    // Delete the first invitation
    await tabpanel.getByRole('button', { name: /^delete$/i }).first().click()
    const confirmDialog = page.getByRole('dialog')
    await expect(confirmDialog).toBeVisible()
    const deleteResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/invitations') && resp.request().method() === 'DELETE',
    )
    await confirmDialog.getByRole('button', { name: /^delete$/i }).click()
    await deleteResponse
    await expect(confirmDialog).not.toBeVisible({ timeout: 10000 })

    // Verify heading count decremented (auto-retries)
    await expect(countHeading).toHaveText(`Active Invitations (${afterCreateCount - 1})`, { timeout: 10000 })
  })
})
