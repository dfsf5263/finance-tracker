import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockHouseholdAccess } from '@/test/mocks/auth'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireHouseholdWriteAccess: vi.fn(),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { POST } from '@/app/api/transactions/bulk/route'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
const mockRequireWriteAccess = vi.mocked(requireHouseholdWriteAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

const validTransaction = {
  account: 'Chase Checking',
  transactionDate: '2024-01-15',
  description: 'Coffee Shop',
  category: 'Food',
  type: 'Purchase',
  amount: '12.50',
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/transactions/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
  // checkDuplicateTransactions runs before auth — ensure it resolves to empty array
  mockDb.transaction.findMany.mockResolvedValue([] as never)
})

describe('POST /api/transactions/bulk', () => {
  it('returns 400 when body fails schema validation (missing householdId)', async () => {
    const response = await POST(makePostRequest({ transactions: [validTransaction] }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toBe('Validation failed')
    expect(body.validationErrors).toBeDefined()
  })

  it('returns 400 when householdId is not a UUID', async () => {
    const response = await POST(
      makePostRequest({ householdId: 'not-a-uuid', transactions: [validTransaction] })
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 when transactions array is empty', async () => {
    const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [] }))
    expect(response.status).toBe(400)
  })

  it('inserts valid transactions and returns success', async () => {
    // Entity validation: accounts, categories, types, users
    mockDb.householdAccount.findMany.mockResolvedValue([
      { id: 'acct-1', name: 'Chase Checking' },
    ] as never)
    mockDb.householdCategory.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food' }] as never)
    mockDb.householdType.findMany.mockResolvedValue([{ id: 'type-1', name: 'Purchase' }] as never)
    mockDb.householdUser.findMany.mockResolvedValue([] as never)

    // Duplicate check: no existing duplicates
    mockDb.transaction.findMany.mockResolvedValue([] as never)

    // createMany success
    mockDb.transaction.createMany.mockResolvedValue({ count: 1 } as never)

    const response = await POST(
      makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
    )

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(mockDb.transaction.createMany).toHaveBeenCalledOnce()
  })

  it('returns 403 when user lacks write access', async () => {
    mockRequireWriteAccess.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await POST(
      makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
    )
    expect(response.status).toBe(403)
  })
})
