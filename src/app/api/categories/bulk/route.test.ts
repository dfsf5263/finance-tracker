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

import { POST } from '@/app/api/categories/bulk/route'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
const mockRequireWriteAccess = vi.mocked(requireHouseholdWriteAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/categories/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
})

describe('POST /api/categories/bulk', () => {
  describe('validation', () => {
    it('returns 400 when householdId is missing', async () => {
      const response = await POST(makePostRequest({ categories: [{ name: 'Food' }] }))
      expect(response.status).toBe(400)
    })

    it('returns 400 when categories array is missing', async () => {
      const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID }))
      expect(response.status).toBe(400)
    })

    it('returns 400 when categories array is empty', async () => {
      const response = await POST(makePostRequest({ householdId: HOUSEHOLD_ID, categories: [] }))
      expect(response.status).toBe(400)
    })
  })

  describe('role access', () => {
    it('allows OWNER access', async () => {
      mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('OWNER'))
      mockDb.householdCategory.findMany.mockResolvedValue([] as never)
      mockDb.householdCategory.createMany.mockResolvedValue({ count: 1 } as never)
      // Second findMany returns created categories
      mockDb.householdCategory.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([{ id: 'cat-1', name: 'Food', householdId: HOUSEHOLD_ID }] as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, categories: [{ name: 'Food' }] })
      )
      expect(response.status).toBe(200)
    })

    it('allows MEMBER access', async () => {
      mockRequireWriteAccess.mockResolvedValue(mockHouseholdAccess('MEMBER'))
      mockDb.householdCategory.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([{ id: 'cat-1', name: 'Food', householdId: HOUSEHOLD_ID }] as never)
      mockDb.householdCategory.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, categories: [{ name: 'Food' }] })
      )
      expect(response.status).toBe(200)
    })

    it('returns 403 for VIEWER role', async () => {
      mockRequireWriteAccess.mockResolvedValue(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      )

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, categories: [{ name: 'Food' }] })
      )
      expect(response.status).toBe(403)
    })

    it('returns 401 when unauthenticated', async () => {
      mockRequireWriteAccess.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, categories: [{ name: 'Food' }] })
      )
      expect(response.status).toBe(401)
    })
  })

  describe('success', () => {
    it('skips all when all categories already exist', async () => {
      mockDb.householdCategory.findMany.mockResolvedValue([{ name: 'Food' }] as never)

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, categories: [{ name: 'Food' }] })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.created).toEqual([])
      expect(body.skipped).toBe(1)
    })

    it('creates new categories and skips duplicates', async () => {
      mockDb.householdCategory.findMany
        .mockResolvedValueOnce([{ name: 'Food' }] as never)
        .mockResolvedValueOnce([
          { id: 'cat-2', name: 'Transport', householdId: HOUSEHOLD_ID },
        ] as never)
      mockDb.householdCategory.createMany.mockResolvedValue({ count: 1 } as never)

      const response = await POST(
        makePostRequest({
          householdId: HOUSEHOLD_ID,
          categories: [{ name: 'Food' }, { name: 'Transport' }],
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
      mockDb.householdCategory.findMany.mockRejectedValue(new Error('DB error'))

      const response = await POST(
        makePostRequest({ householdId: HOUSEHOLD_ID, categories: [{ name: 'Food' }] })
      )
      expect(response.status).toBe(500)
    })
  })
})
