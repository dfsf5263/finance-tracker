import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockAuthContext } from '@/test/mocks/auth'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { POST } from '@/app/api/households/bulk/route'
import { requireAuth } from '@/lib/auth-middleware'
const mockRequireAuth = vi.mocked(requireAuth)

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/households/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue(mockAuthContext())
})

describe('POST /api/households/bulk', () => {
  describe('validation', () => {
    it('returns 400 when households array is missing', async () => {
      const response = await POST(makePostRequest({}))
      expect(response.status).toBe(400)
    })

    it('returns 400 when households array is empty', async () => {
      const response = await POST(makePostRequest({ households: [] }))
      expect(response.status).toBe(400)
    })
  })

  describe('role access', () => {
    it('allows any authenticated user', async () => {
      mockRequireAuth.mockResolvedValue(mockAuthContext())
      mockDb.userHousehold.findMany.mockResolvedValue([] as never)
      mockDb.household.create.mockResolvedValue({ id: 'hh-1', name: 'Test Household' } as never)
      mockDb.userHousehold.create.mockResolvedValue({} as never)

      const response = await POST(makePostRequest({ households: [{ name: 'Test Household' }] }))
      expect(response.status).toBe(200)
    })

    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )

      const response = await POST(makePostRequest({ households: [{ name: 'Test Household' }] }))
      expect(response.status).toBe(401)
    })
  })

  describe('success', () => {
    it('skips all when all households already exist', async () => {
      mockDb.userHousehold.findMany.mockResolvedValue([{ household: { name: 'My Home' } }] as never)

      const response = await POST(makePostRequest({ households: [{ name: 'My Home' }] }))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.created).toEqual([])
      expect(body.skipped).toBe(1)
    })

    it('creates new households and skips duplicates', async () => {
      mockDb.userHousehold.findMany.mockResolvedValue([{ household: { name: 'My Home' } }] as never)
      mockDb.household.create.mockResolvedValue({ id: 'hh-2', name: 'Vacation' } as never)
      mockDb.userHousehold.create.mockResolvedValue({} as never)

      const response = await POST(
        makePostRequest({
          households: [{ name: 'My Home' }, { name: 'Vacation' }],
        })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.skipped).toBe(1)
      expect(body.created).toHaveLength(1)
    })

    it('creates households with annualBudget', async () => {
      mockDb.userHousehold.findMany.mockResolvedValue([] as never)
      mockDb.household.create.mockResolvedValue({
        id: 'hh-1',
        name: 'Home',
        annualBudget: 120000,
      } as never)
      mockDb.userHousehold.create.mockResolvedValue({} as never)

      const response = await POST(
        makePostRequest({
          households: [{ name: 'Home', annualBudget: 120000 }],
        })
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.created).toHaveLength(1)
    })
  })

  describe('errors', () => {
    it('returns 500 when database throws', async () => {
      mockDb.userHousehold.findMany.mockRejectedValue(new Error('DB error'))

      const response = await POST(makePostRequest({ households: [{ name: 'Test' }] }))
      expect(response.status).toBe(500)
    })
  })
})
