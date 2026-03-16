import { test as setup } from '@playwright/test'

setup('ensure E2E household', async ({ request }) => {
  // Check whether the E2E household already exists for this user
  const listRes = await request.get('/api/households')
  if (!listRes.ok()) throw new Error(`Failed to fetch households: ${listRes.status()}`)

  const households = (await listRes.json()) as { name: string }[]
  if (households.some((h) => h.name === 'E2E Test Household')) return

  // Create it — the seed should have done this, but guard against a fresh CI run
  // where the seed hasn't been applied yet or the household was manually deleted.
  const createRes = await request.post('/api/households', {
    data: { name: 'E2E Test Household', annualBudget: 60000 },
  })
  if (!createRes.ok()) {
    throw new Error(`Failed to create E2E household: ${createRes.status()}`)
  }
})
