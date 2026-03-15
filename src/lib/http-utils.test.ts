import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toast } from 'sonner'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { apiFetch, rateAwareApiFetch, parseRetryAfter } from '@/lib/http-utils'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockJsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('apiFetch', () => {
  it('returns data and null error on 200', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ id: 1, name: 'Alice' }))

    const result = await apiFetch('/api/users')
    expect(result.data).toEqual({ id: 1, name: 'Alice' })
    expect(result.error).toBeNull()
    expect(result.response.status).toBe(200)
  })

  it('returns null data and error on 4xx', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Not found' }, 404))

    const result = await apiFetch('/api/users/99', { showErrorToast: false })
    expect(result.data).toBeNull()
    expect(result.error).toBe('Not found')
    expect(result.response.status).toBe(404)
  })

  it('shows error toast for 4xx by default', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Bad request' }, 400))

    await apiFetch('/api/users')
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Bad request')
  })

  it('does not show error toast when showErrorToast=false', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Bad request' }, 400))

    await apiFetch('/api/users', { showErrorToast: false })
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it('uses message field from error response when available', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ message: 'Validation failed', error: 'Bad request' }, 422)
    )

    const result = await apiFetch('/api/users', { showErrorToast: false })
    expect(result.error).toBe('Validation failed') // prefers message over error
  })

  it('handles 429 with retry-after header', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ error: 'Rate limit exceeded.' }, 429, { 'Retry-After': '30' })
    )

    const result = await apiFetch('/api/users', { showRateLimitToast: false })
    expect(result.data).toBeNull()
    expect(result.error).toContain('Rate limit exceeded.')
    expect(result.error).toContain('30 seconds')
    expect(result.response.status).toBe(429)
  })

  it('shows rate limit toast on 429 by default', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ error: 'Rate limit exceeded.' }, 429, { 'Retry-After': '60' })
    )

    await apiFetch('/api/users')
    expect(vi.mocked(toast.error)).toHaveBeenCalledOnce()
    const [message] = vi.mocked(toast.error).mock.calls[0]
    expect(message).toContain('60 seconds')
  })

  it('does not show rate limit toast when showRateLimitToast=false', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ error: 'Rate limit exceeded.' }, 429, { 'Retry-After': '60' })
    )

    await apiFetch('/api/users', { showRateLimitToast: false })
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it('returns null data and error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))

    const result = await apiFetch('/api/users', { showErrorToast: false })
    expect(result.data).toBeNull()
    expect(result.error).toBe('Network failure')
    // Response status 0 indicates network failure (browser convention)
    expect(result.response).toBeDefined()
  })

  it('falls back to HTTP status text when error response has no message', async () => {
    mockFetch.mockResolvedValue(
      new Response('{}', { status: 500, statusText: 'Internal Server Error' })
    )

    const result = await apiFetch('/api/users', { showErrorToast: false })
    expect(result.error).toContain('500')
  })
})

describe('rateAwareApiFetch', () => {
  it('returns isRateLimited=true on 429', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ error: 'Rate limit exceeded.' }, 429, { 'Retry-After': '10' })
    )

    const result = await rateAwareApiFetch('/api/users', { showRateLimitToast: false })
    expect(result.isRateLimited).toBe(true)
    expect(result.data).toBeNull()
  })

  it('returns isRateLimited=false on 200', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ items: [] }))

    const result = await rateAwareApiFetch('/api/users')
    expect(result.isRateLimited).toBe(false)
    expect(result.data).toEqual({ items: [] })
  })

  it('returns isRateLimited=false on 4xx non-429', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Not found' }, 404))

    const result = await rateAwareApiFetch('/api/users', { showErrorToast: false })
    expect(result.isRateLimited).toBe(false)
  })
})

describe('parseRetryAfter', () => {
  it('extracts retry seconds from a rate limit error message', () => {
    expect(parseRetryAfter('Rate limit exceeded. Please try again in 30 seconds.')).toBe(30)
  })

  it('returns null when no match', () => {
    expect(parseRetryAfter('Rate limit exceeded. Please try again later.')).toBeNull()
  })

  it('handles different second values', () => {
    expect(parseRetryAfter('try again in 120 seconds')).toBe(120)
    expect(parseRetryAfter('try again in 5 seconds')).toBe(5)
  })
})
