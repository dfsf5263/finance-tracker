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

import { GET, POST } from '@/app/api/households/route'
import { requireAuth } from '@/lib/auth-middleware'
const mockRequireAuth = vi.mocked(requireAuth)

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/households', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockRequireAuth.mockResolvedValue(mockAuthContext())
})

describe('GET /api/households', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await GET(makeRequest('GET'))
    expect(response.status).toBe(401)
  })

  it('returns 401 when user not found in db', async () => {
    mockDb.user.findUnique.mockResolvedValue(null as never)

    const response = await GET(makeRequest('GET'))
    expect(response.status).toBe(401)
  })

  it('returns households with userRole', async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: 'test-user-id',
      households: [
        {
          role: 'OWNER',
          household: {
            id: 'hh-1',
            name: 'My Home',
            _count: { accounts: 2, users: 1, categories: 5, types: 3 },
          },
        },
      ],
    } as never)

    const response = await GET(makeRequest('GET'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('hh-1')
    expect(body[0].userRole).toBe('OWNER')
  })
})

describe('POST /api/households', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await POST(makeRequest('POST', { name: 'Test' }))
    expect(response.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const response = await POST(makeRequest('POST', { annualBudget: 50000 }))
    expect(response.status).toBe(400)

    const body = await response.json()
    // Zod v4: missing required field reports "name: Invalid input: ..."
    expect(body.error).toContain('name:')
  })

  it('returns 400 when name is empty string', async () => {
    const response = await POST(makeRequest('POST', { name: '' }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Household name is required')
  })

  it('creates household and returns 201', async () => {
    const createdHousehold = {
      id: 'hh-new',
      name: 'Test Household',
      annualBudget: '50000',
      _count: { accounts: 0, users: 1, categories: 0, types: 0 },
    }

    // $transaction is set up in the global beforeEach to pass through
    mockDb.household.create.mockResolvedValue({ id: 'hh-new', name: 'Test Household' } as never)
    mockDb.userHousehold.create.mockResolvedValue({} as never)
    mockDb.household.findUnique.mockResolvedValue(createdHousehold as never)

    const response = await POST(
      makeRequest('POST', { name: 'Test Household', annualBudget: 50000 })
    )
    expect(response.status).toBe(201)

    expect(mockDb.household.create).toHaveBeenCalledOnce()
    const createCall = mockDb.household.create.mock.calls[0][0]
    expect(createCall.data.name).toBe('Test Household')
    expect(createCall.data.annualBudget).toBe(50000)
  })

  it('creates household without annualBudget', async () => {
    mockDb.household.create.mockResolvedValue({ id: 'hh-new', name: 'No Budget' } as never)
    mockDb.userHousehold.create.mockResolvedValue({} as never)
    mockDb.household.findUnique.mockResolvedValue({
      id: 'hh-new',
      name: 'No Budget',
      _count: { accounts: 0, users: 1, categories: 0, types: 0 },
    } as never)

    const response = await POST(makeRequest('POST', { name: 'No Budget' }))
    expect(response.status).toBe(201)
  })
})
