import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockAuthContext, mockHouseholdAccess } from '@/test/mocks/auth'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireTransactionAccess: vi.fn(),
  requireTransactionWriteAccess: vi.fn(),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { GET, PUT, DELETE } from '@/app/api/transactions/[id]/route'
import { requireTransactionAccess, requireTransactionWriteAccess } from '@/lib/auth-middleware'

const mockRequireAccess = vi.mocked(requireTransactionAccess)
const mockRequireWriteAccess = vi.mocked(requireTransactionWriteAccess)

const TRANSACTION_ID = 'a1b2c3d4-e5f6-4789-8abc-def012345678'
const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

const mockTransaction = {
  id: TRANSACTION_ID,
  householdId: HOUSEHOLD_ID,
  accountId: 'acct-1',
  userId: 'user-1',
  categoryId: 'cat-1',
  typeId: 'type-1',
  description: 'Coffee Shop',
  amount: { toNumber: () => -12.5 },
  memo: null,
  transactionDate: new Date('2024-01-15T00:00:00.000Z'),
  postDate: new Date('2024-01-16T00:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  account: { id: 'acct-1', name: 'Chase' },
  user: null,
  category: { id: 'cat-1', name: 'Food' },
  type: { id: 'type-1', name: 'Purchase', isOutflow: true },
}

const mockAccessResult = {
  transaction: mockTransaction,
  authContext: mockAuthContext(),
  userRole: 'OWNER' as const,
}

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/transactions/${TRANSACTION_ID}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const params = Promise.resolve({ id: TRANSACTION_ID })

beforeEach(() => {
  mockRequireAccess.mockResolvedValue(mockAccessResult as never)
  mockRequireWriteAccess.mockResolvedValue(mockAccessResult as never)
})

describe('GET /api/transactions/[id]', () => {
  it('returns 403 passthrough when auth fails', async () => {
    mockRequireAccess.mockResolvedValue(
      NextResponse.json({ error: 'Access denied' }, { status: 403 })
    )

    const response = await GET(makeRequest('GET'), { params })
    expect(response.status).toBe(403)
  })

  it('returns transaction with dates transformed to YYYY-MM-DD', async () => {
    const response = await GET(makeRequest('GET'), { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.transactionDate).toBe('2024-01-15')
    expect(body.postDate).toBe('2024-01-16')
    expect(body.id).toBe(TRANSACTION_ID)
  })
})

describe('PUT /api/transactions/[id]', () => {
  const validBody = {
    accountId: 'a1b2c3d4-e5f6-4012-8abc-def012345678',
    userId: null,
    transactionDate: '2024-01-15',
    postDate: '2024-01-15',
    description: 'Coffee Shop',
    categoryId: 'b2c3d4e5-f6a7-4123-9bcd-ef0123456789',
    typeId: 'c3d4e5f6-a7b8-4234-8cde-f01234567890',
    amount: '12.50',
  }

  it('returns auth error passthrough', async () => {
    mockRequireWriteAccess.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await PUT(makeRequest('PUT', validBody), { params })
    expect(response.status).toBe(403)
  })

  it('returns 400 for invalid request body', async () => {
    const response = await PUT(makeRequest('PUT', { description: '' }), { params })
    expect(response.status).toBe(400)
  })

  it('returns 409 on Prisma P2002 unique constraint error', async () => {
    const prismaError = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      name: 'PrismaClientKnownRequestError',
    })
    // Make it look like a PrismaClientKnownRequestError
    Object.setPrototypeOf(prismaError, Object.getPrototypeOf(new Error()))
    // Patch instanceof check by using the Prisma export
    const { Prisma } = await import('@prisma/client')
    const actualError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '0.0.0',
    })

    mockDb.transaction.update.mockRejectedValue(actualError as never)

    const response = await PUT(makeRequest('PUT', validBody), { params })
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('Duplicate transaction')
  })

  it('returns updated transaction with transformed dates on success', async () => {
    mockDb.transaction.update.mockResolvedValue({
      ...mockTransaction,
      description: 'Updated description',
    } as never)

    const response = await PUT(makeRequest('PUT', validBody), { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.transactionDate).toBe('2024-01-15')
    expect(body.postDate).toBe('2024-01-16')
  })
})

describe('DELETE /api/transactions/[id]', () => {
  it('returns auth error passthrough', async () => {
    mockRequireWriteAccess.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await DELETE(makeRequest('DELETE'), { params })
    expect(response.status).toBe(403)
  })

  it('returns {success: true} on deletion', async () => {
    mockDb.transaction.delete.mockResolvedValue({} as never)

    const response = await DELETE(makeRequest('DELETE'), { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
  })
})
