import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../.auth/user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Wait for redirect to dashboard after successful login
  await page.waitForURL('/dashboard')
  await expect(page.getByRole('main')).toBeVisible()

  // Persist the authenticated session for all subsequent tests
  await page.context().storageState({ path: authFile })
})
