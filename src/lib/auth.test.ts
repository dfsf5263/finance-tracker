import { describe, expect, it } from 'vitest'
import { shouldUseSecureCookies } from '@/lib/auth'

describe('shouldUseSecureCookies', () => {
  it('returns true for https app urls', () => {
    expect(shouldUseSecureCookies('https://finance.example.com', 'development')).toBe(true)
  })

  it('returns true in production even when app url is http', () => {
    expect(shouldUseSecureCookies('http://internal-service:3000', 'production')).toBe(true)
  })

  it('returns false for http app urls outside production', () => {
    expect(shouldUseSecureCookies('http://localhost:3000', 'development')).toBe(false)
  })
})
