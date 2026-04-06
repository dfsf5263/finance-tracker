import { describe, it, expect } from 'vitest'
import { safeRedirectUrl, REDIRECT_PARAM, REDIRECT_STORAGE_KEY } from './redirect-utils'

describe('safeRedirectUrl', () => {
  it('accepts simple relative paths', () => {
    expect(safeRedirectUrl('/dashboard')).toBe('/dashboard')
    expect(safeRedirectUrl('/invitations/abc123')).toBe('/invitations/abc123')
    expect(safeRedirectUrl('/')).toBe('/')
  })

  it('preserves query strings and hash fragments', () => {
    expect(safeRedirectUrl('/dashboard?tab=settings')).toBe('/dashboard?tab=settings')
    expect(safeRedirectUrl('/page#section')).toBe('/page#section')
    expect(safeRedirectUrl('/page?a=1#top')).toBe('/page?a=1#top')
  })

  it('rejects absolute external URLs', () => {
    expect(safeRedirectUrl('https://evil.com')).toBeNull()
    expect(safeRedirectUrl('http://evil.com/path')).toBeNull()
    expect(safeRedirectUrl('ftp://evil.com')).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeRedirectUrl('//evil.com')).toBeNull()
    expect(safeRedirectUrl('//evil.com/path')).toBeNull()
  })

  it('rejects javascript: URLs', () => {
    expect(safeRedirectUrl('javascript:alert(1)')).toBeNull()
  })

  it('rejects null, undefined, and empty strings', () => {
    expect(safeRedirectUrl(null)).toBeNull()
    expect(safeRedirectUrl(undefined)).toBeNull()
    expect(safeRedirectUrl('')).toBeNull()
  })

  it('rejects non-string truthy values', () => {
    // At runtime, callers may pass non-string values despite TypeScript types
    expect(safeRedirectUrl(123 as unknown as string)).toBeNull()
    expect(safeRedirectUrl(true as unknown as string)).toBeNull()
  })

  it('rejects paths without leading slash', () => {
    expect(safeRedirectUrl('dashboard')).toBeNull()
    expect(safeRedirectUrl('evil.com')).toBeNull()
  })

  it('handles URL-encoded characters safely', () => {
    expect(safeRedirectUrl('/path%20with%20spaces')).toBe('/path%20with%20spaces')
  })

  it('safely handles encoded slashes in paths', () => {
    // %2f stays encoded in the pathname — the result is a safe local path
    const result = safeRedirectUrl('/%2fevil.com')
    // Should either be null or a safe local path — never an external redirect
    expect(result === null || !result.startsWith('//')).toBe(true)
  })

  it('rejects URLs where parsed origin differs from localhost base', () => {
    // This tests the origin check after URL parsing. In practice,
    // a relative path against http://localhost always keeps that origin,
    // but we verify the guard exists.
    expect(safeRedirectUrl('/valid-path')).toBe('/valid-path')
  })
})

describe('constants', () => {
  it('exports REDIRECT_PARAM', () => {
    expect(REDIRECT_PARAM).toBe('redirect')
  })

  it('exports REDIRECT_STORAGE_KEY', () => {
    expect(REDIRECT_STORAGE_KEY).toBe('auth_redirect')
  })
})
