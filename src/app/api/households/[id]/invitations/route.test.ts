import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockAuthContext, mockHouseholdAccess } from '@/test/mocks/auth'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(),
  requireHouseholdAccess: vi.fn(),
}))
vi.mock('@/lib/role-utils', () => ({
  canInviteMembers: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { GET, POST } from '@/app/api/households/[id]/invitations/route'
import { requireAuth, requireHouseholdAccess } from '@/lib/auth-middleware'
import { canInviteMembers } from '@/lib/role-utils'

const mockRequireAuth = vi.mocked(requireAuth)
const mockRequireHouseholdAccess = vi.mocked(requireHouseholdAccess)
const mockCanInviteMembers = vi.mocked(canInviteMembers)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'
const USER_ID = 'test-user-id'

const invitations = [{ id: 'inv-1', role: 'MEMBER', status: 'PENDING', inviter: {}, invitee: null }]

const createdInvitation = {
  id: 'inv-new',
  token: 'abc-token',
  role: 'MEMBER',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  household: { name: 'Smith Family' },
  inviter: { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
}

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/households/${HOUSEHOLD_ID}/invitations`)
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/households/${HOUSEHOLD_ID}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: HOUSEHOLD_ID })

beforeEach(() => {
  mockRequireAuth.mockResolvedValue(mockAuthContext() as never)
  mockRequireHouseholdAccess.mockResolvedValue(mockHouseholdAccess('OWNER') as never)
  mockCanInviteMembers.mockReturnValue(true)
  mockDb.userHousehold.findUnique.mockResolvedValue({ role: 'OWNER' } as never)
  mockDb.householdInvitation.findMany.mockResolvedValue(invitations as never)
  mockDb.householdInvitation.create.mockResolvedValue(createdInvitation as never)
})

describe('GET /api/households/[id]/invitations', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    const response = await GET(makeGetRequest(), { params })
    expect(response.status).toBe(401)
  })

  it('returns 403 when user is not a household member', async () => {
    mockDb.userHousehold.findUnique.mockResolvedValue(null as never)
    const response = await GET(makeGetRequest(), { params })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Access denied')
  })

  it('returns list of invitations for household members', async () => {
    const response = await GET(makeGetRequest(), { params })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(mockDb.householdInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: HOUSEHOLD_ID } })
    )
  })
})

describe('POST /api/households/[id]/invitations', () => {
  it('returns access result when requireHouseholdAccess returns NextResponse', async () => {
    mockRequireHouseholdAccess.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const response = await POST(makePostRequest({ role: 'MEMBER' }), { params })
    expect(response.status).toBe(401)
  })

  it('returns 403 when user cannot invite members', async () => {
    mockCanInviteMembers.mockReturnValue(false)
    const response = await POST(makePostRequest({ role: 'MEMBER' }), { params })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('owner')
  })

  it('returns 400 when role is missing', async () => {
    const response = await POST(makePostRequest({}), { params })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Valid role is required')
  })

  it('returns 400 when role is invalid', async () => {
    const response = await POST(makePostRequest({ role: 'SUPERADMIN' }), { params })
    expect(response.status).toBe(400)
  })

  it('returns 403 when MEMBER tries to invite OWNER', async () => {
    mockRequireHouseholdAccess.mockResolvedValue(mockHouseholdAccess('MEMBER') as never)
    mockCanInviteMembers.mockReturnValue(false)
    const response = await POST(makePostRequest({ role: 'OWNER' }), { params })
    expect(response.status).toBe(403)
  })

  it('creates invitation and returns 201', async () => {
    const response = await POST(makePostRequest({ role: 'MEMBER' }), { params })
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe('inv-new')
    expect(body.role).toBe('MEMBER')
    expect(mockDb.householdInvitation.create).toHaveBeenCalledOnce()
  })
})
