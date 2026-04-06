import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const { GET } = await import('./route')

describe('GET /api/instance-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns emailEnabled true when RESEND_API_KEY is set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('DISABLE_SIGNUPS', '')

    const request = new NextRequest('http://localhost:3000/api/instance-settings')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.emailEnabled).toBe(true)
    expect(data.signupsEnabled).toBe(true)
  })

  it('returns emailEnabled false when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('DISABLE_SIGNUPS', '')

    const request = new NextRequest('http://localhost:3000/api/instance-settings')
    const response = await GET(request)
    const data = await response.json()

    expect(data.emailEnabled).toBe(false)
  })

  it('returns signupsEnabled false when DISABLE_SIGNUPS is true', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('DISABLE_SIGNUPS', 'true')

    const request = new NextRequest('http://localhost:3000/api/instance-settings')
    const response = await GET(request)
    const data = await response.json()

    expect(data.signupsEnabled).toBe(false)
  })

  it('returns signupsEnabled true when DISABLE_SIGNUPS is not true', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('DISABLE_SIGNUPS', 'false')

    const request = new NextRequest('http://localhost:3000/api/instance-settings')
    const response = await GET(request)
    const data = await response.json()

    expect(data.signupsEnabled).toBe(true)
  })

  it('sets Cache-Control header', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('DISABLE_SIGNUPS', '')

    const request = new NextRequest('http://localhost:3000/api/instance-settings')
    const response = await GET(request)

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300')
  })
})
