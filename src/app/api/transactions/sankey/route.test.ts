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

  it('returns 400 for invalid endDate', async () => {
    const response = await GET(
      makeGetRequest({ householdId: HOUSEHOLD_ID, endDate: 'bad-date' })
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid endDate')
  })

  it('applies typeId filter when provided', async () => {
    const response = await GET(
      makeGetRequest({ householdId: HOUSEHOLD_ID, typeId: 'some-type-id' })
    )
    expect(response.status).toBe(200)

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.typeId).toBe('some-type-id')
  })

  it('returns empty nodes and links when no transactions exist', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    const body = await response.json()
    expect(body.nodes).toEqual([])
    expect(body.links).toEqual([])
  })

  it('builds income -> user -> expense sankey graph', async () => {
    mockDb.transaction.findMany.mockResolvedValue([
      {
        amount: { toString: () => '3000' },
        account: { name: 'Employer' },
        user: { name: 'Alice' },
        category: { name: 'Salary' },
        type: { isOutflow: false },
      },
      {
        amount: { toString: () => '50' },
        account: { name: 'Checking' },
        user: { name: 'Alice' },
        category: { name: 'Groceries' },
        type: { isOutflow: true },
      },
    ] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    const body = await response.json()

    // Nodes: income sources sorted, then users sorted, then expense categories sorted
    expect(body.nodes).toHaveLength(3)
    expect(body.nodes[0]).toEqual({ name: 'Employer', type: 'income' }) // income source
    expect(body.nodes[1]).toEqual({ name: 'Alice', type: 'user' }) // user
    expect(body.nodes[2]).toEqual({ name: 'Groceries', type: 'expense' }) // expense category

    // Links: income -> user, user -> expense
    expect(body.links).toHaveLength(2)
    expect(body.links).toContainEqual({
      source: 0, // Employer
      target: 1, // Alice
      value: 3000,
      type: 'income',
    })
    expect(body.links).toContainEqual({
      source: 1, // Alice
      target: 2, // Groceries
      value: 50,
      type: 'expense',
    })
  })

  it('aggregates multiple transactions for the same link', async () => {
    mockDb.transaction.findMany.mockResolvedValue([
      {
        amount: { toString: () => '25' },
        account: { name: 'Checking' },
        user: { name: 'Bob' },
        category: { name: 'Food' },
        type: { isOutflow: true },
      },
      {
        amount: { toString: () => '75' },
        account: { name: 'Checking' },
        user: { name: 'Bob' },
        category: { name: 'Food' },
        type: { isOutflow: true },
      },
    ] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    const body = await response.json()

    // Single aggregated link: Bob -> Food = 100
    expect(body.links).toHaveLength(1)
    expect(body.links[0].value).toBe(100)
  })

  it('uses absolute value for negative amounts', async () => {
    mockDb.transaction.findMany.mockResolvedValue([
      {
        amount: { toString: () => '-500' },
        account: { name: 'Refund Source' },
        user: { name: 'Alice' },
        category: { name: 'Returns' },
        type: { isOutflow: false },
      },
    ] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    const body = await response.json()

    expect(body.links[0].value).toBe(500) // absolute value
  })

  it('falls back to "Household" when user is null', async () => {
    mockDb.transaction.findMany.mockResolvedValue([
      {
        amount: { toString: () => '100' },
        account: { name: 'Cash' },
        user: null,
        category: { name: 'Misc' },
        type: { isOutflow: true },
      },
    ] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    const body = await response.json()

    const userNode = body.nodes.find((n: { type: string }) => n.type === 'user')
    expect(userNode.name).toBe('Household')
  })

  it('falls back to "Unknown Account" when account is null', async () => {
    mockDb.transaction.findMany.mockResolvedValue([
      {
        amount: { toString: () => '200' },
        account: null,
        user: { name: 'Alice' },
        category: { name: 'Salary' },
        type: { isOutflow: false },
      },
    ] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    const body = await response.json()

    const incomeNode = body.nodes.find((n: { type: string }) => n.type === 'income')
    expect(incomeNode.name).toBe('Unknown Account')
  })

  it('falls back to "Unknown Category" when category is null', async () => {
    mockDb.transaction.findMany.mockResolvedValue([
      {
        amount: { toString: () => '30' },
        account: { name: 'Checking' },
        user: { name: 'Alice' },
        category: null,
        type: { isOutflow: true },
      },
    ] as never)

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    const body = await response.json()

    const expenseNode = body.nodes.find((n: { type: string }) => n.type === 'expense')
    expect(expenseNode.name).toBe('Unknown Category')
  })

  it('returns 500 when database throws', async () => {
    mockDb.transaction.findMany.mockRejectedValueOnce(new Error('DB down'))

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to fetch sankey data')
  })
})
