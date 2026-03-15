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

import { POST } from '@/app/api/invitations/by-token/[token]/accept/route'
import { requireAuth } from '@/lib/auth-middleware'

const mockRequireAuth = vi.mocked(requireAuth)

const TOKEN = 'valid-invite-token-abc123'
const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'
const USER_ID = 'test-user-id'

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

const validInvitation = {
  id: 'inv-1',
  token: TOKEN,
  role: 'MEMBER',
  status: 'PENDING',
  expiresAt: futureDate,
  householdId: HOUSEHOLD_ID,
  inviterUserId: 'other-user-id',
  household: { name: 'Smith Family' },
  inviter: { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
}

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/invitations/by-token/${TOKEN}/accept`, {
    method: 'POST',
  })
}

const params = Promise.resolve({ token: TOKEN })

beforeEach(() => {
  mockRequireAuth.mockResolvedValue(mockAuthContext() as never)
  mockDb.householdInvitation.findUnique.mockResolvedValue(validInvitation as never)
  mockDb.userHousehold.findUnique.mockResolvedValue(null as never) // not a member yet
  mockDb.$transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb)
  )
  mockDb.userHousehold.create.mockResolvedValue({ role: 'MEMBER' } as never)
  mockDb.householdInvitation.update.mockResolvedValue({} as never)
})

describe('POST /api/invitations/by-token/[token]/accept', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await POST(makeRequest(), { params })
    expect(response.status).toBe(401)
  })

  it('returns 404 when token not found', async () => {
    mockDb.householdInvitation.findUnique.mockResolvedValue(null as never)

    const response = await POST(makeRequest(), { params })
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Invitation not found')
  })

  it('returns 400 when invitation is expired', async () => {
    mockDb.householdInvitation.findUnique.mockResolvedValue({
      ...validInvitation,
      expiresAt: new Date(Date.now() - 1000),
    } as never)

    const response = await POST(makeRequest(), { params })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invitation has expired')
  })

  it('returns 400 when invitation is not pending (already accepted)', async () => {
    mockDb.householdInvitation.findUnique.mockResolvedValue({
      ...validInvitation,
      status: 'ACCEPTED',
    } as never)

    const response = await POST(makeRequest(), { params })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invitation is no longer valid')
  })

  it('returns 400 when user is already a member', async () => {
    mockDb.userHousehold.findUnique.mockResolvedValue({
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      role: 'MEMBER',
    } as never)

    const response = await POST(makeRequest(), { params })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('already a member')
  })

  it('creates userHousehold and updates invitation on success', async () => {
    const response = await POST(makeRequest(), { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.household.name).toBe('Smith Family')
    expect(body.role).toBe('MEMBER')

    expect(mockDb.userHousehold.create).toHaveBeenCalledOnce()
    const createCall = mockDb.userHousehold.create.mock.calls[0][0]
    expect(createCall.data.userId).toBe(USER_ID)
    expect(createCall.data.householdId).toBe(HOUSEHOLD_ID)
    expect(createCall.data.role).toBe('MEMBER')
    expect(createCall.data.weeklySummary).toBe(true)

    expect(mockDb.householdInvitation.update).toHaveBeenCalledOnce()
    const updateCall = mockDb.householdInvitation.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('ACCEPTED')
  })
})
