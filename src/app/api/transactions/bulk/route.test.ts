import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockHouseholdAccess } from '@/test/mocks/auth'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/client'

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

function setupEntityMocks(
  overrides: {
    accounts?: Array<{ id: string; name: string }>
    categories?: Array<{ id: string; name: string }>
    types?: Array<{ id: string; name: string }>
    users?: Array<{ id: string; name: string }>
  } = {}
) {
  mockDb.householdAccount.findMany.mockResolvedValue(
    (overrides.accounts ?? [{ id: 'acct-1', name: 'Chase Checking' }]) as never
  )
  mockDb.householdCategory.findMany.mockResolvedValue(
    (overrides.categories ?? [{ id: 'cat-1', name: 'Food' }]) as never
  )
  mockDb.householdType.findMany.mockResolvedValue(
    (overrides.types ?? [{ id: 'type-1', name: 'Purchase' }]) as never
  )
  mockDb.householdUser.findMany.mockResolvedValue(
    (overrides.users ?? []) as never
  )
}

beforeEach(() => {
  mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
  mockDb.transaction.findMany.mockResolvedValue([] as never)
})

describe('POST /api/transactions/bulk', () => {
  describe('validation', () => {
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
      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [] })
      )
      expect(response.status).toBe(400)
    })
  })

  describe('auth', () => {
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

  describe('successful insert', () => {
    it('inserts valid transactions and returns success', async () => {
      setupEntityMocks()
      mockDb.transaction.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.successful).toBe(1)
      expect(body.results.failed).toBe(0)
      expect(mockDb.transaction.createMany).toHaveBeenCalledOnce()
    })

    it('inserts multiple valid transactions', async () => {
      const tx2 = { ...validTransaction, description: 'Groceries', amount: '55.00' }
      setupEntityMocks()
      mockDb.transaction.createMany.mockResolvedValue({ count: 2 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction, tx2] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.total).toBe(2)
      expect(body.results.successful).toBe(2)
    })

    it('maps user name to userId when user field is provided', async () => {
      const txWithUser = { ...validTransaction, user: 'John' }
      setupEntityMocks({ users: [{ id: 'user-1', name: 'John' }] })
      mockDb.transaction.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [txWithUser] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.successful).toBe(1)
    })
  })

  describe('intra-file duplicate detection', () => {
    it('detects duplicate transactions within the same upload', async () => {
      const duplicate = { ...validTransaction }
      setupEntityMocks()
      mockDb.transaction.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          transactions: [validTransaction, duplicate],
        })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      // First occurrence is kept, second is flagged as duplicate
      expect(body.results.successful).toBe(1)
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].type).toBe('duplicate')
      expect(body.results.failures[0].reason).toContain('Duplicate transaction within file')
    })
  })

  describe('database duplicate detection', () => {
    it('detects transactions that already exist in the database', async () => {
      // Return an existing match from the DB
      mockDb.transaction.findMany.mockResolvedValue([
        {
          createdAt: new Date('2024-01-15'),
          amount: new Decimal(12.5),
          description: 'Coffee Shop',
          transactionDate: new Date('2024-01-15'),
          account: { name: 'Chase Checking' },
        },
      ] as never)

      setupEntityMocks()

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.successful).toBe(0)
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].type).toBe('duplicate')
      expect(body.results.failures[0].reason).toContain('Duplicate transaction exists in database')
      expect(body.results.failures[0].existingTransaction).toBeDefined()
    })
  })

  describe('entity validation', () => {
    it('reports failure when account is not found', async () => {
      setupEntityMocks({ accounts: [] })
      mockDb.transaction.createMany.mockResolvedValue({ count: 0 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.successful).toBe(0)
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].reason).toContain('Account "Chase Checking" not found')
    })

    it('reports failure when category is not found', async () => {
      setupEntityMocks({ categories: [] })
      mockDb.transaction.createMany.mockResolvedValue({ count: 0 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].reason).toContain('Category "Food" not found')
    })

    it('reports failure when type is not found', async () => {
      setupEntityMocks({ types: [] })
      mockDb.transaction.createMany.mockResolvedValue({ count: 0 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].reason).toContain('Type "Purchase" not found')
    })

    it('reports failure when user is not found', async () => {
      const txWithUser = { ...validTransaction, user: 'UnknownUser' }
      setupEntityMocks({ users: [] })
      mockDb.transaction.createMany.mockResolvedValue({ count: 0 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [txWithUser] })
      )

      const body = await response.json()
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].reason).toContain('User "UnknownUser" not found')
    })

    it('inserts valid transactions and reports failures for invalid ones (partial insert)', async () => {
      const badTx = {
        ...validTransaction,
        account: 'Nonexistent Account',
        description: 'Different Transaction',
        amount: '99.00',
      }
      setupEntityMocks()
      mockDb.transaction.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          transactions: [validTransaction, badTx],
        })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.successful).toBe(1)
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].reason).toContain('Account "Nonexistent Account" not found')
      expect(body.message).toContain('1 failures')
    })

    it('reports multiple missing entity errors on a single transaction', async () => {
      setupEntityMocks({ accounts: [], categories: [], types: [] })
      mockDb.transaction.createMany.mockResolvedValue({ count: 0 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.results.failed).toBe(1)
      const reason = body.results.failures[0].reason
      expect(reason).toContain('Account "Chase Checking" not found')
      expect(reason).toContain('Category "Food" not found')
      expect(reason).toContain('Type "Purchase" not found')
    })
  })

  describe('database error handling', () => {
    it('handles P2002 unique constraint violation during createMany', async () => {
      setupEntityMocks()
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      })
      mockDb.$transaction.mockRejectedValueOnce(p2002Error)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.successful).toBe(0)
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].type).toBe('duplicate')
      expect(body.results.failures[0].reason).toContain('Unique constraint violation')
    })

    it('handles general database errors during transaction', async () => {
      setupEntityMocks()
      mockDb.$transaction.mockRejectedValueOnce(new Error('Connection lost'))

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.successful).toBe(0)
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].type).toBe('validation')
      expect(body.results.failures[0].reason).toBe('Connection lost')
    })

    it('returns 500 for unexpected top-level errors', async () => {
      // Force request.json() to throw by passing invalid JSON
      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Failed to create bulk transactions')
    })
  })

  describe('date transformation in failures', () => {
    it('transforms ISO datetime to date-only format in failure responses', async () => {
      // DB duplicate with ISO datetime that has T in it
      mockDb.transaction.findMany.mockResolvedValue([
        {
          createdAt: new Date('2024-01-15T00:00:00.000Z'),
          amount: new Decimal(12.5),
          description: 'Coffee Shop',
          transactionDate: new Date('2024-01-15T00:00:00.000Z'),
          account: { name: 'Chase Checking' },
        },
      ] as never)

      setupEntityMocks()

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.results.failures[0].transaction.transactionDate).not.toContain('T')
    })
  })
})
