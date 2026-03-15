import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import {
  requestSizeLimit,
  bulkUploadSizeLimit,
  standardApiSizeLimit,
} from '@/lib/middleware/request-size'

function makeRequest(contentLength?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (contentLength !== undefined) headers['content-length'] = contentLength
  return new NextRequest('http://localhost/api/test', { method: 'POST', headers })
}

describe('requestSizeLimit', () => {
  const limit = requestSizeLimit(1024) // 1KB for test

  it('returns 413 when Content-Length exceeds limit', async () => {
    const result = await limit(makeRequest('2048'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(413)

    const body = await result!.json()
    expect(body.maxSizeBytes).toBe(1024)
    expect(body.providedSizeBytes).toBe(2048)
  })

  it('returns null when Content-Length is within limit', async () => {
    const result = await limit(makeRequest('512'))
    expect(result).toBeNull()
  })

  it('returns null when Content-Length equals the limit', async () => {
    const result = await limit(makeRequest('1024'))
    expect(result).toBeNull()
  })

  it('returns null when Content-Length header is absent', async () => {
    const result = await limit(makeRequest())
    expect(result).toBeNull()
  })
})

describe('bulkUploadSizeLimit (10MB)', () => {
  const tenMB = 10 * 1024 * 1024

  it('allows requests within 10MB', async () => {
    const result = await bulkUploadSizeLimit(makeRequest(String(tenMB - 1)))
    expect(result).toBeNull()
  })

  it('rejects requests over 10MB', async () => {
    const result = await bulkUploadSizeLimit(makeRequest(String(tenMB + 1)))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(413)
  })
})

describe('standardApiSizeLimit (1MB)', () => {
  const oneMB = 1 * 1024 * 1024

  it('allows requests within 1MB', async () => {
    const result = await standardApiSizeLimit(makeRequest(String(oneMB - 1)))
    expect(result).toBeNull()
  })

  it('rejects requests over 1MB', async () => {
    const result = await standardApiSizeLimit(makeRequest(String(oneMB + 1)))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(413)
  })
})
