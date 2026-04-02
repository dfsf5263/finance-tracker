#!/usr/bin/env node
/**
 * Debug script — mirrors the Playwright API key test.
 * Usage: node scripts/test-api-key.mjs <api-key> [base-url]
 *
 * Example:
 *   node scripts/test-api-key.mjs ft_abc123
 *   node scripts/test-api-key.mjs ft_abc123 http://localhost:3000
 */

const key = process.argv[2]
const baseURL = process.argv[3] ?? 'http://localhost:3000'

if (!key) {
  console.error('Usage: node scripts/test-api-key.mjs <api-key> [base-url]')
  process.exit(1)
}

const url = `${baseURL}/api/households`
console.log(`\nGET ${url}`)
console.log(`x-api-key: ${key}\n`)

const response = await fetch(url, {
  headers: { 'x-api-key': key },
  redirect: 'manual', // show redirects rather than following them
})

console.log(`Status:  ${response.status} ${response.statusText}`)
console.log('Headers:')
for (const [k, v] of response.headers.entries()) {
  console.log(`  ${k}: ${v}`)
}

const raw = await response.text()
console.log(`\nBody (raw):\n${raw}`)

try {
  const json = JSON.parse(raw)
  console.log('\nBody (parsed):', JSON.stringify(json, null, 2))
} catch {
  console.log('\n[Body is not JSON — likely an HTML error page or redirect]')
}
