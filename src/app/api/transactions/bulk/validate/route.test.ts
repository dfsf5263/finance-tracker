import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockHouseholdAccess } from '@/test/mocks/auth'
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

import { POST } from '@/app/api/transactions/bulk/validate/route'
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
  return new NextRequest('http://localhost/api/transactions/bulk/validate', {
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
  mockDb.householdUser.findMany.mockResolvedValue((overrides.users ?? []) as never)
}

beforeEach(() => {
  mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
  mockDb.transaction.findMany.mockResolvedValue([] as never)
})

describe('POST /api/transactions/bulk/validate', () => {
  describe('validation', () => {
    it('returns 400 when body fails schema validation', async () => {
      const response = await POST(makePostRequest({ transactions: [validTransaction] }))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Validation failed')
    })

    it('returns 400 when transactions array is empty', async () => {
      const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [] }))
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

  describe('all-valid case', () => {
    it('returns 0 failures when all transactions are valid', async () => {
      setupEntityMocks()

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.results.total).toBe(1)
      expect(body.results.valid).toBe(1)
      expect(body.results.failed).toBe(0)
      expect(body.results.failures).toHaveLength(0)
    })

    it('does not insert any transactions', async () => {
      setupEntityMocks()

      await POST(makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] }))

      expect(mockDb.transaction.createMany).not.toHaveBeenCalled()
      expect(mockDb.transaction.create).not.toHaveBeenCalled()
    })
  })

  describe('intra-file duplicates', () => {
    it('detects duplicate transactions within the file', async () => {
      setupEntityMocks()

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          transactions: [validTransaction, validTransaction],
        })
      )

      const body = await response.json()
      expect(body.results.failed).toBe(1)
      expect(body.results.valid).toBe(1)
      expect(body.results.failures[0].issues[0].kind).toBe('duplicate')
      expect(body.results.failures[0].issues[0].message).toContain(
        'Duplicate transaction within file'
      )
    })
  })

  describe('database duplicates', () => {
    it('detects transactions that exist in the database', async () => {
      setupEntityMocks()
      mockDb.transaction.findMany.mockResolvedValue([
        {
          createdAt: new Date('2024-01-15'),
          amount: new Decimal(12.5),
          description: 'Coffee Shop',
          transactionDate: new Date('2024-01-15'),
          account: { name: 'Chase Checking' },
        },
      ] as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].issues[0].kind).toBe('duplicate')
      expect(body.results.failures[0].issues[0].message).toBe(
        'Duplicate transaction exists in database'
      )
      expect(body.results.failures[0].existingTransaction).toBeDefined()
    })
  })

  describe('entity validation', () => {
    it('detects missing entities', async () => {
      setupEntityMocks({ accounts: [] })

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, transactions: [validTransaction] })
      )

      const body = await response.json()
      expect(body.results.failed).toBe(1)
      expect(body.results.failures[0].issues[0].kind).toBe('entity')
      expect(body.results.failures[0].issues[0].message).toContain(
        'Account "Chase Checking" is not defined'
      )
      expect(body.results.failures[0].issues[0].fields).toContain('account')
    })
  })

  describe('mixed case', () => {
    it('returns both valid and failed counts for mixed input', async () => {
      setupEntityMocks()
      const goodTx = validTransaction
      const badTx = { ...validTransaction, account: 'Unknown Bank' }

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          transactions: [goodTx, badTx],
        })
      )

      const body = await response.json()
      expect(body.results.total).toBe(2)
      expect(body.results.valid).toBe(1)
      expect(body.results.failed).toBe(1)
    })
  })

  describe('response shape', () => {
    it('includes index and row in failure objects', async () => {
      setupEntityMocks()

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          transactions: [validTransaction, validTransaction],
        })
      )

      const body = await response.json()
      const failure = body.results.failures[0]
      expect(failure).toHaveProperty('index')
      expect(failure).toHaveProperty('row')
      expect(failure).toHaveProperty('issues')
      expect(failure).toHaveProperty('transaction')
    })

    it('transforms transaction dates to date-only format', async () => {
      setupEntityMocks()

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          transactions: [validTransaction, validTransaction],
        })
      )

      const body = await response.json()
      const txDate = body.results.failures[0].transaction.transactionDate
      expect(txDate).not.toContain('T')
    })
  })
})
