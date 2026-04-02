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

import { POST } from '@/app/api/types/bulk/route'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
const mockRequireWriteAccess = vi.mocked(requireHouseholdWriteAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/types/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
})

describe('POST /api/types/bulk', () => {
  describe('validation', () => {
    it('returns 400 when householdId is missing', async () => {
      const response = await POST(
        makePostRequest({ types: [{ name: 'Purchase', isOutflow: true }] })
      )
      expect(response.status).toBe(400)
    })

    it('returns 400 when types array is missing', async () => {
      const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID }))
      expect(response.status).toBe(400)
    })

    it('returns 400 when types array is empty', async () => {
      const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID, types: [] }))
      expect(response.status).toBe(400)
    })
  })

  describe('role access', () => {
    it('allows OWNER access', async () => {
      mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
      mockDb.householdType.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([
          { id: 'type-1', name: 'Purchase', isOutflow: true, householdId: HOUSEHOLD_ID },
        ] as never)
      mockDb.householdType.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          types: [{ name: 'Purchase', isOutflow: true }],
        })
      )
      expect(response.status).toBe(200)
    })

    it('allows MEMBER access', async () => {
      mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('MEMBER'))
      mockDb.householdType.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([
          { id: 'type-1', name: 'Purchase', isOutflow: true, householdId: HOUSEHOLD_ID },
        ] as never)
      mockDb.householdType.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          types: [{ name: 'Purchase', isOutflow: true }],
        })
      )
      expect(response.status).toBe(200)
    })

    it('returns 403 for VIEWER role', async () => {
      mockRequireWriteAccess.mockResolvedValue(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      )

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          types: [{ name: 'Purchase', isOutflow: true }],
        })
      )
      expect(response.status).toBe(403)
    })

    it('returns 401 when unauthenticated', async () => {
      mockRequireWriteAccess.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          types: [{ name: 'Purchase', isOutflow: true }],
        })
      )
      expect(response.status).toBe(401)
    })
  })

  describe('success', () => {
    it('skips all when all types already exist', async () => {
      mockDb.householdType.findMany.mockResolvedValue([{ name: 'Purchase' }] as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          types: [{ name: 'Purchase', isOutflow: true }],
        })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.created).toEqual([])
      expect(body.skipped).toBe(1)
    })

    it('creates new types and skips duplicates', async () => {
      mockDb.householdType.findMany
        .mockResolvedValueOnce([{ name: 'Purchase' }] as never)
        .mockResolvedValueOnce([
          { id: 'type-2', name: 'Refund', isOutflow: false, householdId: HOUSEHOLD_ID },
        ] as never)
      mockDb.householdType.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          types: [
            { name: 'Purchase', isOutflow: true },
            { name: 'Refund', isOutflow: false },
          ],
        })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.skipped).toBe(1)
      expect(body.created).toHaveLength(1)
    })
  })

  describe('errors', () => {
    it('returns 500 when database throws', async () => {
      mockDb.householdType.findMany.mockRejectedValue(new Error('DB error'))

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          types: [{ name: 'Purchase', isOutflow: true }],
        })
      )
      expect(response.status).toBe(500)
    })
  })
})
