import { describe, expect, it } from 'vitest'
import { shouldUseSecureCookies } from '@/lib/auth'

describe('shouldUseSecureCookies', () => {
  it('returns true in production', () => {
    expect(shouldUseSecureCookies('production')).toBe(true)
  })

  it('returns false in development', () => {
    expect(shouldUseSecureCookies('development')).toBe(false)
  })

  it('returns false when NODE_ENV is not set', () => {
    expect(shouldUseSecureCookies(undefined)).toBe(false)
  })
})
