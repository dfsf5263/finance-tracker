import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({ $Infer: {} })),
}))
vi.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: vi.fn(),
}))
vi.mock('better-auth/plugins', () => ({
  twoFactor: vi.fn(),
}))
vi.mock('@better-auth/api-key', () => ({
  apiKey: vi.fn(),
}))
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}))
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn(),
}))
vi.mock('@/lib/email/send-verification-email', () => ({
  sendEmailVerification: vi.fn(),
}))
vi.mock('@/lib/email/send-password-reset-email', () => ({
  sendPasswordResetEmail: vi.fn(),
}))

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

describe('getAuth', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('initializes auth instance with signupsEnabled from env', async () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000')
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test')
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('DISABLE_SIGNUPS', '')

    const { betterAuth } = await import('better-auth')
    const { getAuth } = await import('@/lib/auth')
    const result = getAuth()

    expect(result).toBeDefined()
    expect(vi.mocked(betterAuth)).toHaveBeenCalledWith(
      expect.objectContaining({
        disabledPaths: [],
      })
    )
  })

  it('passes disabledPaths when signups are disabled', async () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000')
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test')
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('DISABLE_SIGNUPS', 'true')

    const { betterAuth } = await import('better-auth')
    const { getAuth } = await import('@/lib/auth')
    const result = getAuth()

    expect(result).toBeDefined()
    expect(vi.mocked(betterAuth)).toHaveBeenCalledWith(
      expect.objectContaining({
        disabledPaths: ['/sign-up/email'],
      })
    )
  })
})
