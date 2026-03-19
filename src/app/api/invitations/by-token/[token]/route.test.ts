import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDb } from '@/test/mocks/db'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { GET } from '@/app/api/invitations/by-token/[token]/route'

const TOKEN = 'valid-invite-token-abc123'

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
const pastDate = new Date(Date.now() - 1000) // 1 second ago

const validInvitation = {
  id: 'inv-1',
  token: TOKEN,
  role: 'MEMBER',
  status: 'PENDING',
  expiresAt: futureDate,
  createdAt: new Date(),
  household: {
    id: 'd4e5f6a7-b8c9-4123-8efa-234567890123',
    name: 'Smith Family',
    _count: { members: 3 },
  },
  inviter: {
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
  },
}

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/invitations/by-token/${TOKEN}`)
}

const params = Promise.resolve({ token: TOKEN })

beforeEach(() => {
  mockDb.householdInvitation.findUnique.mockResolvedValue(validInvitation as never)
})

describe('GET /api/invitations/by-token/[token]', () => {
  it('returns 404 when token not found', async () => {
    mockDb.householdInvitation.findUnique.mockResolvedValue(null as never)

    const response = await GET(makeRequest(), { params })
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Invitation not found')
  })

  it('returns 400 when invitation is expired', async () => {
    mockDb.householdInvitation.findUnique.mockResolvedValue({
      ...validInvitation,
      expiresAt: pastDate,
    } as never)

    const response = await GET(makeRequest(), { params })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invitation has expired')
  })

  it('returns 400 when invitation is no longer pending', async () => {
    mockDb.householdInvitation.findUnique.mockResolvedValue({
      ...validInvitation,
      status: 'ACCEPTED',
    } as never)

    const response = await GET(makeRequest(), { params })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invitation is no longer valid')
  })

  it('returns invitation details without token or status on success', async () => {
    const response = await GET(makeRequest(), { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.id).toBe('inv-1')
    expect(body.household.name).toBe('Smith Family')
    expect(body.inviter.firstName).toBe('Alice')
    expect(body.role).toBe('MEMBER')
    // Sensitive fields should not be in response
    expect(body.token).toBeUndefined()
    expect(body.status).toBeUndefined()
  })
})
