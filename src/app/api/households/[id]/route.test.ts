import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockHouseholdAccess } from '@/test/mocks/auth'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireHouseholdAccess: vi.fn(),
}))
vi.mock('@/lib/role-utils', () => ({
  canManageHouseholdSettings: vi.fn(),
  canDeleteHousehold: vi.fn(),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { GET, PUT, DELETE } from '@/app/api/households/[id]/route'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
import { canManageHouseholdSettings, canDeleteHousehold } from '@/lib/role-utils'

const mockRequireAccess = vi.mocked(requireHouseholdAccess)
const mockCanManageSettings = vi.mocked(canManageHouseholdSettings)
const mockCanDelete = vi.mocked(canDeleteHousehold)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

const householdWithCounts = {
  id: HOUSEHOLD_ID,
  name: 'My Home',
  annualBudget: null,
  _count: { accounts: 2, users: 3, categories: 5, types: 4 },
}

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/households/${HOUSEHOLD_ID}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const params = Promise.resolve({ id: HOUSEHOLD_ID })

beforeEach(() => {
  mockRequireAccess.mockResolvedValue(mockHouseholdAccess('OWNER') as never)
  mockCanManageSettings.mockReturnValue(true)
  mockCanDelete.mockReturnValue(true)
  mockDb.household.findUnique.mockResolvedValue(householdWithCounts as never)
})

describe('GET /api/households/[id]', () => {
  it('returns auth error passthrough', async () => {
    mockRequireAccess.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await GET(makeRequest('GET'), { params })
    expect(response.status).toBe(401)
  })

  it('returns household with counts', async () => {
    const response = await GET(makeRequest('GET'), { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.id).toBe(HOUSEHOLD_ID)
    expect(body._count.accounts).toBe(2)
  })
})

describe('PUT /api/households/[id]', () => {
  it('returns 403 when not owner (canManageHouseholdSettings returns false)', async () => {
    mockCanManageSettings.mockReturnValue(false)

    const response = await PUT(makeRequest('PUT', { name: 'New Name' }), { params })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('owner')
  })

  it('returns auth error passthrough', async () => {
    mockRequireAccess.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

    const response = await PUT(makeRequest('PUT', { name: 'New Name' }), { params })
    expect(response.status).toBe(403)
  })

  it('updates household name', async () => {
    mockDb.household.update.mockResolvedValue({ ...householdWithCounts, name: 'New Name' } as never)

    const response = await PUT(makeRequest('PUT', { name: 'New Name' }), { params })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.name).toBe('New Name')

    expect(mockDb.household.update).toHaveBeenCalledOnce()
    const updateCall = mockDb.household.update.mock.calls[0][0]
    expect(updateCall.data.name).toBe('New Name')
  })

  it('clears annualBudget when set to null', async () => {
    mockDb.household.update.mockResolvedValue({
      ...householdWithCounts,
      annualBudget: null,
    } as never)

    const response = await PUT(makeRequest('PUT', { annualBudget: null }), { params })
    expect(response.status).toBe(200)

    const updateCall = mockDb.household.update.mock.calls[0][0]
    expect(updateCall.data.annualBudget).toBeNull()
  })

  it('sets annualBudget when provided', async () => {
    mockDb.household.update.mockResolvedValue({
      ...householdWithCounts,
      annualBudget: '60000',
    } as never)

    const response = await PUT(makeRequest('PUT', { annualBudget: 60000 }), { params })
    expect(response.status).toBe(200)

    const updateCall = mockDb.household.update.mock.calls[0][0]
    expect(updateCall.data.annualBudget).toBe(60000)
  })
})

describe('DELETE /api/households/[id]', () => {
  it('returns 403 when not owner (canDeleteHousehold returns false)', async () => {
    mockCanDelete.mockReturnValue(false)

    const response = await DELETE(makeRequest('DELETE'), { params })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('owner')
  })

  it('returns auth error passthrough', async () => {
    mockRequireAccess.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

    const response = await DELETE(makeRequest('DELETE'), { params })
    expect(response.status).toBe(403)
  })

  it('deletes household and returns success', async () => {
    // Mock all count queries
    mockDb.transaction.count.mockResolvedValue(5 as never)
    mockDb.userHousehold.count.mockResolvedValue(2 as never)
    mockDb.householdInvitation.count.mockResolvedValue(1 as never)
    mockDb.householdAccount.count.mockResolvedValue(3 as never)
    mockDb.householdUser.count.mockResolvedValue(4 as never)
    mockDb.householdCategory.count.mockResolvedValue(6 as never)
    mockDb.householdType.count.mockResolvedValue(2 as never)
    mockDb.household.delete.mockResolvedValue({} as never)

    const response = await DELETE(makeRequest('DELETE'), { params })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toContain('deleted successfully')
    expect(body.deletedCounts).toBeDefined()
  })
})
