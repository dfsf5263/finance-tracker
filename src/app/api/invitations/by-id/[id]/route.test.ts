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

import { DELETE } from '@/app/api/invitations/by-id/[id]/route'
import { requireAuth } from '@/lib/auth-middleware'

const mockRequireAuth = vi.mocked(requireAuth)

const INVITATION_ID = 'inv-abc-123'
const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'
const OTHER_USER_ID = 'other-user-id'

const invitation = {
  id: INVITATION_ID,
  householdId: HOUSEHOLD_ID,
  inviterUserId: OTHER_USER_ID, // not the caller by default
  role: 'MEMBER',
  status: 'PENDING',
}

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/invitations/by-id/${INVITATION_ID}`, {
    method: 'DELETE',
  })
}

const params = Promise.resolve({ id: INVITATION_ID })

beforeEach(() => {
  mockRequireAuth.mockResolvedValue(mockAuthContext() as never)
  mockDb.householdInvitation.findUnique.mockResolvedValue(invitation as never)
  mockDb.userHousehold.findUnique.mockResolvedValue({ role: 'OWNER' } as never)
  mockDb.householdInvitation.delete.mockResolvedValue({} as never)
})

describe('DELETE /api/invitations/by-id/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await DELETE(makeRequest(), { params })
    expect(response.status).toBe(401)
  })

  it('returns 404 when invitation not found', async () => {
    mockDb.householdInvitation.findUnique.mockResolvedValue(null as never)

    const response = await DELETE(makeRequest(), { params })
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Invitation not found')
  })

  it('returns 403 when user is MEMBER and not the inviter', async () => {
    mockDb.userHousehold.findUnique.mockResolvedValue({ role: 'MEMBER' } as never)
    // inviterUserId = OTHER_USER_ID, caller = USER_ID → should be denied

    const response = await DELETE(makeRequest(), { params })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Access denied')
  })

  it('returns 403 when user has no household membership', async () => {
    mockDb.userHousehold.findUnique.mockResolvedValue(null as never)

    const response = await DELETE(makeRequest(), { params })
    expect(response.status).toBe(403)
  })

  it('allows OWNER to delete invitation they did not create', async () => {
    mockDb.userHousehold.findUnique.mockResolvedValue({ role: 'OWNER' } as never)
    // inviterUserId is OTHER_USER_ID, but user is OWNER

    const response = await DELETE(makeRequest(), { params })
    expect(response.status).toBe(200)
    expect(mockDb.householdInvitation.delete).toHaveBeenCalledOnce()
  })

  it('allows inviter to delete their own invitation even as MEMBER', async () => {
    mockRequireAuth.mockResolvedValue(mockAuthContext({ userId: OTHER_USER_ID }) as never)
    mockDb.userHousehold.findUnique.mockResolvedValue({ role: 'MEMBER' } as never)
    // inviterUserId = OTHER_USER_ID = caller → allowed

    const response = await DELETE(makeRequest(), { params })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
  })
})
