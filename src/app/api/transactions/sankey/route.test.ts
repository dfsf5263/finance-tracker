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

import { GET } from '@/app/api/transactions/sankey/route'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
const mockRequireHouseholdAccess = vi.mocked(requireHouseholdAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/transactions/sankey')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

beforeEach(() => {
  mockRequireHouseholdAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
  mockDb.transaction.findMany.mockResolvedValue([] as never)
})

describe('GET /api/transactions/sankey', () => {
  it('returns 400 when householdId is missing', async () => {
    const response = await GET(makeGetRequest({}))
    expect(response.status).toBe(400)
  })

  it('returns 400 when date range exceeds 366 days', async () => {
    const response = await GET(
      makeGetRequest({
        householdId: HOUSEHOLD_ID,
        startDate: '2023-01-01',
        endDate: '2024-12-31', // ~730 days
      })
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('1 year')
  })

  it('returns 400 for invalid startDate', async () => {
    const response = await GET(
      makeGetRequest({ householdId: HOUSEHOLD_ID, startDate: 'not-a-date' })
    )
    expect(response.status).toBe(400)
  })

  it('returns 200 with valid date range within 1 year', async () => {
    const response = await GET(
      makeGetRequest({
        householdId: HOUSEHOLD_ID,
        startDate: '2024-01-01',
        endDate: '2024-06-30',
      })
    )
    expect(response.status).toBe(200)
    expect(mockDb.transaction.findMany).toHaveBeenCalledOnce()
  })

  it('clamps open-ended start date to endDate - 1 year', async () => {
    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, endDate: '2024-06-30' }))
    expect(response.status).toBe(200)

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.transactionDate).toBeDefined()
  })

  it('clamps open-ended end date to startDate + 1 year', async () => {
    const response = await GET(
      makeGetRequest({ householdId: HOUSEHOLD_ID, startDate: '2024-01-01' })
    )
    expect(response.status).toBe(200)

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.transactionDate).toBeDefined()
  })

  it('returns 401 when auth fails', async () => {
    mockRequireHouseholdAccess.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(401)
  })
})
