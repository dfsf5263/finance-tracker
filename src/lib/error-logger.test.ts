import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import logger from '@/lib/logger'

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}))

import { logApiError } from '@/lib/error-logger'

function makeRequest(
  options: {
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    contentType?: string
  } = {}
): NextRequest {
  const {
    url = 'http://localhost/api/test',
    method = 'GET',
    headers = {},
    body,
    contentType,
  } = options

  const allHeaders: Record<string, string> = { ...headers }
  if (contentType) {
    allHeaders['content-type'] = contentType
  }

  return new NextRequest(url, {
    method,
    headers: allHeaders,
    ...(body ? { body } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('logApiError', () => {
  it('logs the error message and operation', async () => {
    const error = new Error('database error')
    const request = makeRequest()

    await logApiError({ request, error, operation: 'fetch users' })

    expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
    const [loggedData, message] = vi.mocked(logger.error).mock.calls[0] as [
      Record<string, unknown>,
      string,
    ]
    expect(message).toBe('api error')
    expect(loggedData.err).toBe(error)
    expect(loggedData.operation).toBe('fetch users')
    expect(loggedData.method).toBe('GET')
  })

  it('converts non-Error objects to Error instances', async () => {
    const request = makeRequest()

    await logApiError({ request, error: 'a plain string error' })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    expect(loggedData.err).toBeInstanceOf(Error)
    expect((loggedData.err as Error).message).toBe('a plain string error')
  })

  it('masks authorization headers', async () => {
    const request = makeRequest({
      headers: { authorization: 'Bearer supersecrettoken123' },
    })

    await logApiError({ request, error: new Error('err') })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    const headers = loggedData.headers as Record<string, string>
    expect(headers.authorization).toMatch(/^Be\*\*\*23$/)
    expect(headers.authorization).not.toContain('supersecrettoken123')
  })

  it('masks token headers', async () => {
    const request = makeRequest({
      headers: { 'x-api-token': 'mytoken1234' },
    })

    await logApiError({ request, error: new Error('err') })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    const headers = loggedData.headers as Record<string, string>
    expect(headers['x-api-token']).toMatch(/^my\*\*\*34$/)
  })

  it('sanitizes password fields in JSON request body', async () => {
    const request = makeRequest({
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({ username: 'alice', password: 'hunter2' }),
    })

    await logApiError({ request, error: new Error('err') })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    const body = loggedData.body as Record<string, unknown>
    expect(body.username).toBe('alice')
    expect(body.password).toMatch(/^hu\*\*\*r2$/)
    expect(body.password).not.toBe('hunter2')
  })

  it('sanitizes token fields in context', async () => {
    const request = makeRequest()

    await logApiError({
      request,
      error: new Error('err'),
      context: { userId: 'abc', access_token: 'tok123' },
    })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    const context = loggedData.context as Record<string, unknown>
    expect(context.userId).toBe('abc')
    expect(context.access_token).toMatch(/^to\*\*\*23$/)
  })

  it('adds dbErrorCode when error has a code property', async () => {
    const dbError = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    const request = makeRequest()

    await logApiError({ request, error: dbError })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    expect(loggedData.dbErrorCode).toBe('P2002')
  })

  it('adds dbErrorMeta when error has a meta property', async () => {
    const dbError = Object.assign(new Error('err'), { code: 'P2002', meta: { target: ['email'] } })
    const request = makeRequest()

    await logApiError({ request, error: dbError })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    expect(loggedData.dbErrorMeta).toEqual({ target: ['email'] })
  })

  it('does not include body when request has no body', async () => {
    const request = makeRequest({ method: 'GET' })

    await logApiError({ request, error: new Error('err') })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    expect(loggedData.body).toBeUndefined()
  })

  it('includes the request URL in the log', async () => {
    const request = makeRequest({ url: 'http://localhost/api/transactions?hello=world' })

    await logApiError({ request, error: new Error('err') })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    expect(loggedData.url).toContain('/api/transactions')
  })

  it('extracts correlationId from x-correlation-id header', async () => {
    const request = makeRequest({
      headers: { 'x-correlation-id': 'abc-123-def' },
    })

    await logApiError({ request, error: new Error('err'), operation: 'fetch data' })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    expect(loggedData.correlationId).toBe('abc-123-def')
  })

  it('logs null correlationId when header is absent', async () => {
    const request = makeRequest()

    await logApiError({ request, error: new Error('err') })

    const [loggedData] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>, string]
    expect(loggedData.correlationId).toBeNull()
  })

  it('handles logging failure gracefully', async () => {
    vi.mocked(logger.error).mockImplementationOnce(() => {
      throw new Error('logging broken')
    })

    const request = makeRequest()

    await expect(
      logApiError({ request, error: new Error('original error') })
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledTimes(2)
  })
})
