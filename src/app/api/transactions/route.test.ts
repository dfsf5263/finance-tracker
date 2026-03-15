import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockHouseholdAccess } from '@/test/mocks/auth'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireHouseholdAccess: vi.fn(),
  requireHouseholdWriteAccess: vi.fn(),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { GET } from '@/app/api/transactions/route'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
const mockRequireHouseholdAccess = vi.mocked(requireHouseholdAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/transactions')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

beforeEach(() => {
  mockRequireHouseholdAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
})

describe('GET /api/transactions', () => {
  it('returns 400 when householdId is missing', async () => {
    const response = await GET(makeGetRequest({ page: '1' }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('householdId is required')
  })

  it('returns 400 when page is not a valid number', async () => {
    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, page: 'abc' }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('page:')
  })

  it('returns 400 when limit exceeds 1000', async () => {
    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, limit: '99999' }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('limit:')
  })

  it('returns 401 when auth fails', async () => {
    mockRequireHouseholdAccess.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    // householdId is checked first, so auth runs after; include it
    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(401)
  })

  it('calls findMany with correct skip/take and returns 200', async () => {
    const now = new Date().toISOString()
    mockDb.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        description: 'Test',
        amount: 10,
        transactionDate: new Date(now),
        postDate: new Date(now),
        account: { name: 'Chase' },
        user: null,
        category: { name: 'Food' },
        type: { name: 'Purchase' },
      },
    ] as never)
    mockDb.transaction.count.mockResolvedValue(1 as never)

    const response = await GET(
      makeGetRequest({ householdId: HOUSEHOLD_ID, page: '2', limit: '10' })
    )
    expect(response.status).toBe(200)

    expect(mockDb.transaction.findMany).toHaveBeenCalledOnce()
    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.skip).toBe(10) // (page 2 - 1) * limit 10
    expect(call?.take).toBe(10)

    const body = await response.json()
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(10)
    expect(body.pagination.total).toBe(1)
  })
})
