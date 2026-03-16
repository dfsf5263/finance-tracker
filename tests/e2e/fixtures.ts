import { test as base } from '@playwright/test'

/**
 * Extended test fixture that captures browser console output and uncaught
 * page errors for every test. Failures are attached to the test report.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleMessages: string[] = []
    const pageErrors: string[] = []

    page.on('console', (msg) => {
      const type = msg.type()
      if (type === 'error' || type === 'warning') {
        consoleMessages.push(`[${type.toUpperCase()}] ${msg.text()}`)
      }
    })

    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await use(page)

    if (consoleMessages.length > 0) {
      await testInfo.attach('browser-console', {
        body: consoleMessages.join('\n'),
        contentType: 'text/plain',
      })
    }

    if (pageErrors.length > 0) {
      await testInfo.attach('page-errors', {
        body: pageErrors.join('\n'),
        contentType: 'text/plain',
      })
    }
  },
})

export { expect, type Page } from '@playwright/test'
