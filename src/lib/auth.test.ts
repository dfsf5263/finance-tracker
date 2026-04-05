import { describe, expect, it } from 'vitest'
import { shouldUseSecureCookies, isSignupsEnabled } from '@/lib/auth'

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

describe('isSignupsEnabled', () => {
  it('returns true when DISABLE_SIGNUPS is not set', () => {
    expect(isSignupsEnabled(undefined)).toBe(true)
  })

  it('returns true when DISABLE_SIGNUPS is an empty string', () => {
    expect(isSignupsEnabled('')).toBe(true)
  })

  it('returns true when DISABLE_SIGNUPS is "false"', () => {
    expect(isSignupsEnabled('false')).toBe(true)
  })

  it('returns false when DISABLE_SIGNUPS is "true"', () => {
    expect(isSignupsEnabled('true')).toBe(false)
  })
})
