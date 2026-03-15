import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockHouseholdAccess } from '@/test/mocks/auth'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireHouseholdAccess: vi.fn(),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { GET } from '@/app/api/transactions/duplicates/route'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
const mockRequireHouseholdAccess = vi.mocked(requireHouseholdAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/transactions/duplicates')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

beforeEach(() => {
  mockRequireHouseholdAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
})

describe('GET /api/transactions/duplicates', () => {
  it('returns 400 when householdId is missing', async () => {
    const response = await GET(makeGetRequest({}))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('householdId is required')
  })

  it('returns 422 when transaction count exceeds 4000', async () => {
    mockDb.transaction.count.mockResolvedValue(4001 as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(422)

    const body = await response.json()
    expect(body.transactionCount).toBe(4001)
    expect(body.limit).toBe(4000)
  })

  it('returns duplicate groups when count is within limit', async () => {
    mockDb.transaction.count.mockResolvedValue(10 as never)
    mockDb.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        transactionDate: new Date('2024-01-15'),
        description: 'Coffee',
        amount: { toNumber: () => 12.5 },
        account: { name: 'Chase' },
        category: { name: 'Food' },
        type: { name: 'Purchase' },
        user: { name: 'Alice' },
        memo: null,
      },
    ] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('duplicatePairs')
    expect(mockDb.transaction.findMany).toHaveBeenCalledOnce()
  })

  it('returns 401 when auth fails', async () => {
    mockDb.transaction.count.mockResolvedValue(5 as never)
    mockRequireHouseholdAccess.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(401)
  })
})
