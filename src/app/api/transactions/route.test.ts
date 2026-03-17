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

import { GET, POST } from '@/app/api/transactions/route'
import { requireHouseholdAccess, requireHouseholdWriteAccess } from '@/lib/auth-middleware'
const mockRequireHouseholdAccess = vi.mocked(requireHouseholdAccess)
const mockRequireHouseholdWriteAccess = vi.mocked(requireHouseholdWriteAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/transactions')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

beforeEach(() => {
  mockRequireHouseholdAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
  mockRequireHouseholdWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
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

  it('applies category filter', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)
    mockDb.transaction.count.mockResolvedValue(0 as never)

    await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, category: 'cat-1' }))

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.categoryId).toBe('cat-1')
  })

  it('applies type filter', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)
    mockDb.transaction.count.mockResolvedValue(0 as never)

    await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, type: 'type-1' }))

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.typeId).toBe('type-1')
  })

  it('applies account filter', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)
    mockDb.transaction.count.mockResolvedValue(0 as never)

    await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, account: 'acct-1' }))

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.accountId).toBe('acct-1')
  })

  it('applies user filter', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)
    mockDb.transaction.count.mockResolvedValue(0 as never)

    await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, user: 'user-1' }))

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.userId).toBe('user-1')
  })

  it('applies __household__ user filter as null userId', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)
    mockDb.transaction.count.mockResolvedValue(0 as never)

    await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, user: '__household__' }))

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.userId).toBeNull()
  })

  it('applies date range filters', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)
    mockDb.transaction.count.mockResolvedValue(0 as never)

    await GET(
      makeGetRequest({
        householdId: HOUSEHOLD_ID,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })
    )

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    const dateFilter = call?.where?.transactionDate as { gte?: Date; lte?: Date }
    expect(dateFilter?.gte).toEqual(new Date('2024-01-01'))
    expect(dateFilter?.lte).toEqual(new Date('2024-01-31'))
  })

  it('applies search filter with OR conditions', async () => {
    mockDb.transaction.findMany.mockResolvedValue([] as never)
    mockDb.transaction.count.mockResolvedValue(0 as never)

    await GET(makeGetRequest({ householdId: HOUSEHOLD_ID, search: 'coffee' }))

    const call = mockDb.transaction.findMany.mock.calls[0][0]
    expect(call?.where?.OR).toHaveLength(5)
  })

  it('returns 500 when findMany throws', async () => {
    mockDb.transaction.findMany.mockRejectedValue(new Error('DB error'))

    const response = await GET(makeGetRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(500)
  })
})

const ACCOUNT_ID = 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789'
const USER_ID_HH = 'c3d4e5f6-a7b8-4901-abcd-ef0123456789'
const CATEGORY_ID = 'd4e5f6a7-b8c9-4012-bcde-f01234567890'
const TYPE_ID = 'e5f6a7b8-c9d0-4123-8def-012345678901'

const validCreateBody = {
  householdId: HOUSEHOLD_ID,
  accountId: ACCOUNT_ID,
  userId: USER_ID_HH,
  transactionDate: '2024-01-15',
  postDate: '2024-01-15',
  description: 'Coffee Shop',
  categoryId: CATEGORY_ID,
  typeId: TYPE_ID,
  amount: '12.50',
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/transactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/transactions', () => {
  it('returns 400 when body fails validation', async () => {
    const response = await POST(makePostRequest({ description: 'Test' }))
    expect(response.status).toBe(400)
  })

  it('returns 403 when user lacks write access', async () => {
    mockRequireHouseholdWriteAccess.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await POST(makePostRequest(validCreateBody))
    expect(response.status).toBe(403)
  })

  it('creates a transaction and returns 201', async () => {
    const txDate = new Date('2024-01-15')
    mockDb.transaction.create.mockResolvedValue({
      id: 'tx-new',
      ...validCreateBody,
      transactionDate: txDate,
      postDate: txDate,
      account: { name: 'Chase' },
      user: null,
      category: { name: 'Food' },
      type: { name: 'Purchase' },
    } as never)

    const response = await POST(makePostRequest(validCreateBody))
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.id).toBe('tx-new')
    expect(body.transactionDate).toBe('2024-01-15')
    expect(mockDb.transaction.create).toHaveBeenCalledOnce()
  })

  it('returns 409 for duplicate transaction (P2002)', async () => {
    const prismaError = new Error('Unique constraint failed')
    Object.assign(prismaError, { code: 'P2002' })
    Object.setPrototypeOf(prismaError, Object.getPrototypeOf(prismaError))
    // We need to fake a PrismaClientKnownRequestError
    mockDb.transaction.create.mockRejectedValue(prismaError)

    // Since instanceof check matters, let's mock it via the Prisma module
    const { Prisma } = await import('@prisma/client')
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '7.0.0',
    })
    mockDb.transaction.create.mockRejectedValue(p2002Error)

    const response = await POST(makePostRequest(validCreateBody))
    expect(response.status).toBe(409)

    const body = await response.json()
    expect(body.error).toContain('Duplicate')
  })

  it('returns 500 on unexpected errors', async () => {
    mockDb.transaction.create.mockRejectedValue(new Error('Unexpected'))

    const response = await POST(makePostRequest(validCreateBody))
    expect(response.status).toBe(500)
  })
})
