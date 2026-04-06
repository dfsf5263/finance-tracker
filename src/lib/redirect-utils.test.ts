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

  it('rejects paths without leading slash', () => {
    expect(safeRedirectUrl('dashboard')).toBeNull()
    expect(safeRedirectUrl('evil.com')).toBeNull()
  })

  it('handles URL-encoded characters safely', () => {
    expect(safeRedirectUrl('/path%20with%20spaces')).toBe('/path%20with%20spaces')
  })

  it('rejects double-encoded slashes that could resolve to //', () => {
    // %2f%2f decodes to // in pathname — the URL constructor normalises this
    // so the result starts with // which we reject
    const result = safeRedirectUrl('/%2fevil.com')
    // Should either be null or a safe local path — never an external redirect
    if (result !== null) {
      expect(result.startsWith('//')).toBe(false)
    }
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
