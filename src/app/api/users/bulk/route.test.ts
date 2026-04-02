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

import { POST } from '@/app/api/users/bulk/route'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
const mockRequireWriteAccess = vi.mocked(requireHouseholdWriteAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/users/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
})

describe('POST /api/users/bulk', () => {
  describe('validation', () => {
    it('returns 400 when householdId is missing', async () => {
      const response = await POST(makePostRequest({ users: [{ name: 'Alice' }] }))
      expect(response.status).toBe(400)
    })

    it('returns 400 when householdId is not a valid UUID', async () => {
      const response = await POST(
        makePostRequest({ householdId: 'not-a-uuid', users: [{ name: 'Alice' }] })
      )
      expect(response.status).toBe(400)
    })

    it('returns 400 when users array is missing', async () => {
      const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID }))
      expect(response.status).toBe(400)
    })

    it('returns 400 when users array is empty', async () => {
      const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID, users: [] }))
      expect(response.status).toBe(400)
    })
  })

  describe('role access', () => {
    it('allows OWNER access', async () => {
      mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
      mockDb.householdUser.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([
          { id: 'user-1', name: 'Alice', householdId: HOUSEHOLD_ID },
        ] as never)
      mockDb.householdUser.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, users: [{ name: 'Alice' }] })
      )
      expect(response.status).toBe(200)
    })

    it('allows MEMBER access', async () => {
      mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('MEMBER'))
      mockDb.householdUser.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([
          { id: 'user-1', name: 'Alice', householdId: HOUSEHOLD_ID },
        ] as never)
      mockDb.householdUser.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, users: [{ name: 'Alice' }] })
      )
      expect(response.status).toBe(200)
    })

    it('returns 403 for VIEWER role', async () => {
      mockRequireWriteAccess.mockResolvedValue(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      )

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, users: [{ name: 'Alice' }] })
      )
      expect(response.status).toBe(403)
    })

    it('returns 401 when unauthenticated', async () => {
      mockRequireWriteAccess.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, users: [{ name: 'Alice' }] })
      )
      expect(response.status).toBe(401)
    })
  })

  describe('success', () => {
    it('skips all when all users already exist', async () => {
      mockDb.householdUser.findMany.mockResolvedValue([{ name: 'Alice' }] as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, users: [{ name: 'Alice' }] })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.created).toEqual([])
      expect(body.skipped).toBe(1)
    })

    it('creates new users and skips duplicates', async () => {
      mockDb.householdUser.findMany
        .mockResolvedValueOnce([{ name: 'Alice' }] as never)
        .mockResolvedValueOnce([{ id: 'user-2', name: 'Bob', householdId: HOUSEHOLD_ID }] as never)
      mockDb.householdUser.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          users: [{ name: 'Alice' }, { name: 'Bob' }],
        })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.skipped).toBe(1)
      expect(body.created).toHaveLength(1)
    })

    it('creates users with annualBudget', async () => {
      mockDb.householdUser.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([
          { id: 'user-1', name: 'Alice', annualBudget: 50000, householdId: HOUSEHOLD_ID },
        ] as never)
      mockDb.householdUser.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          users: [{ name: 'Alice', annualBudget: 50000 }],
        })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.created).toHaveLength(1)
    })
  })

  describe('errors', () => {
    it('returns 500 when database throws', async () => {
      mockDb.householdUser.findMany.mockRejectedValue(new Error('DB error'))

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, users: [{ name: 'Alice' }] })
      )
      expect(response.status).toBe(500)
    })
  })
})
