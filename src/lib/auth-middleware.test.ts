import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-helpers', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/role-utils', () => ({
  canManageData: vi.fn(),
}))

import {
  requireAuth,
  requireHouseholdAccess,
  requireHouseholdWriteAccess,
  requireTransactionAccess,
  requireTransactionWriteAccess,
  requireAccountAccess,
  requireAccountWriteAccess,
  requireCategoryAccess,
  requireCategoryWriteAccess,
  requireTypeAccess,
  requireTypeWriteAccess,
  requireUserAccess,
  requireUserWriteAccess,
} from '@/lib/auth-middleware'
import { getSession } from '@/lib/auth-helpers'
import { canManageData } from '@/lib/role-utils'

const mockGetSession = vi.mocked(getSession)
const mockCanManageData = vi.mocked(canManageData)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'
const USER_ID = 'test-user-id'
const TRANSACTION_ID = 'a1b2c3d4-e5f6-4789-8abc-def012345678'
const ACCOUNT_ID = 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789'
const CATEGORY_ID = 'c3d4e5f6-a7b8-4901-abcd-ef0123456789'
const TYPE_ID = 'd4e5f6a7-b8c9-4012-bcde-f01234567890'
const HH_USER_ID = 'e5f6a7b8-c9d0-4123-cdef-012345678901'

function makeRequest(url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url)
}

const dbUser = {
  id: USER_ID,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
}

beforeEach(() => {
  mockGetSession.mockResolvedValue({ user: { id: USER_ID } } as never)
  mockDb.user.findUnique.mockResolvedValue(dbUser as never)
  mockCanManageData.mockReturnValue(true)
})

describe('requireAuth', () => {
  it('returns 401 when session has no userId', async () => {
    mockGetSession.mockResolvedValue({ user: {} } as never)

    const result = await requireAuth()
    expect(result).toBeInstanceOf(NextResponse)
    const body = await (result as NextResponse).json()
    expect(body.error).toBe('Unauthorized')
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns 401 when session is null', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireAuth()
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns 401 when user not found in DB', async () => {
    mockDb.user.findUnique.mockResolvedValue(null as never)

    const result = await requireAuth()
    expect(result).toBeInstanceOf(NextResponse)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('not properly synced')
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns AuthContext when session and user are valid', async () => {
    const result = await requireAuth()
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as Awaited<ReturnType<typeof requireAuth>>
    if (!(ctx instanceof NextResponse)) {
      expect(ctx.userId).toBe(USER_ID)
      expect(ctx.user.email).toBe('test@example.com')
    }
  })
})

describe('requireHouseholdAccess', () => {
  const memberRecord = {
    role: 'OWNER',
    household: { members: [] },
  }

  it('returns 401 when auth fails', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireHouseholdAccess(makeRequest(), HOUSEHOLD_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns 400 when householdId is empty string', async () => {
    const result = await requireHouseholdAccess(makeRequest(), '')
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Invalid household ID')
  })

  it('returns 403 when user is not a member', async () => {
    mockDb.userHousehold.findFirst.mockResolvedValue(null as never)

    const result = await requireHouseholdAccess(makeRequest(), HOUSEHOLD_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Access denied')
  })

  it('returns authContext and userRole when member exists', async () => {
    mockDb.userHousehold.findFirst.mockResolvedValue(memberRecord as never)

    const result = await requireHouseholdAccess(makeRequest(), HOUSEHOLD_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { authContext: unknown; userRole: string }
    expect(ctx.userRole).toBe('OWNER')
  })
})

describe('requireHouseholdWriteAccess', () => {
  const memberRecord = { role: 'MEMBER', household: { members: [] } }

  it('returns 403 when canManageData returns false', async () => {
    mockDb.userHousehold.findFirst.mockResolvedValue(memberRecord as never)
    mockCanManageData.mockReturnValue(false)

    const result = await requireHouseholdWriteAccess(makeRequest(), HOUSEHOLD_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('permission to modify')
  })

  it('returns access result when canManageData returns true', async () => {
    mockDb.userHousehold.findFirst.mockResolvedValue({
      role: 'OWNER',
      household: { members: [] },
    } as never)
    mockCanManageData.mockReturnValue(true)

    const result = await requireHouseholdWriteAccess(makeRequest(), HOUSEHOLD_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { userRole: string }
    expect(ctx.userRole).toBe('OWNER')
  })

  it('propagates auth failure upward', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireHouseholdWriteAccess(makeRequest(), HOUSEHOLD_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })
})

describe('requireTransactionAccess', () => {
  const transactionWithMember = {
    id: TRANSACTION_ID,
    transactionDate: new Date('2024-01-15'),
    postDate: new Date('2024-01-15'),
    household: {
      members: [{ role: 'MEMBER' }],
    },
  }

  it('returns 400 when transactionId is empty', async () => {
    const result = await requireTransactionAccess(makeRequest(), '')
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Invalid transaction ID')
  })

  it('returns 403 when transaction not found or user not a member', async () => {
    mockDb.transaction.findFirst.mockResolvedValue(null as never)

    const result = await requireTransactionAccess(makeRequest(), TRANSACTION_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Access denied')
  })

  it('returns 500 when user membership has no role', async () => {
    mockDb.transaction.findFirst.mockResolvedValue({
      ...transactionWithMember,
      household: { members: [] }, // No membership found
    } as never)

    const result = await requireTransactionAccess(makeRequest(), TRANSACTION_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(500)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('User role not found')
  })

  it('returns transaction, authContext, userRole on success', async () => {
    mockDb.transaction.findFirst.mockResolvedValue(transactionWithMember as never)

    const result = await requireTransactionAccess(makeRequest(), TRANSACTION_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { transaction: unknown; userRole: string }
    expect(ctx.userRole).toBe('MEMBER')
    expect(ctx.transaction).toBeDefined()
  })

  it('returns 401 when auth fails', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireTransactionAccess(makeRequest(), TRANSACTION_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })
})

describe('requireTransactionWriteAccess', () => {
  it('returns 403 when canManageData returns false', async () => {
    mockDb.transaction.findFirst.mockResolvedValue({
      id: TRANSACTION_ID,
      household: { members: [{ role: 'VIEWER' }] },
    } as never)
    mockCanManageData.mockReturnValue(false)

    const result = await requireTransactionWriteAccess(makeRequest(), TRANSACTION_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })

  it('returns access result when canManageData is true', async () => {
    mockDb.transaction.findFirst.mockResolvedValue({
      id: TRANSACTION_ID,
      household: { members: [{ role: 'OWNER' }] },
    } as never)
    mockCanManageData.mockReturnValue(true)

    const result = await requireTransactionWriteAccess(makeRequest(), TRANSACTION_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
  })
})

describe('requireAccountAccess', () => {
  it('returns 400 when accountId is empty', async () => {
    const result = await requireAccountAccess(makeRequest(), '')
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
  })

  it('returns 403 when account not found', async () => {
    mockDb.householdAccount.findFirst.mockResolvedValue(null as never)

    const result = await requireAccountAccess(makeRequest(), ACCOUNT_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })

  it('returns account and context on success', async () => {
    mockDb.householdAccount.findFirst.mockResolvedValue({
      id: ACCOUNT_ID,
      household: { members: [{ role: 'OWNER' }] },
    } as never)

    const result = await requireAccountAccess(makeRequest(), ACCOUNT_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { account: unknown; userRole: string }
    expect(ctx.account).toBeDefined()
    expect(ctx.userRole).toBe('OWNER')
  })
})

describe('requireAccountWriteAccess', () => {
  it('returns 403 when canManageData is false', async () => {
    mockDb.householdAccount.findFirst.mockResolvedValue({
      id: ACCOUNT_ID,
      household: { members: [{ role: 'VIEWER' }] },
    } as never)
    mockCanManageData.mockReturnValue(false)

    const result = await requireAccountWriteAccess(makeRequest(), ACCOUNT_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })

  it('returns access result when canManageData is true', async () => {
    mockDb.householdAccount.findFirst.mockResolvedValue({
      id: ACCOUNT_ID,
      household: { members: [{ role: 'OWNER' }] },
    } as never)
    mockCanManageData.mockReturnValue(true)

    const result = await requireAccountWriteAccess(makeRequest(), ACCOUNT_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { account: unknown; userRole: string }
    expect(ctx.userRole).toBe('OWNER')
  })
})

describe('requireAccountAccess — edge cases', () => {
  it('returns 500 when user membership has no role', async () => {
    mockDb.householdAccount.findFirst.mockResolvedValue({
      id: ACCOUNT_ID,
      household: { members: [] },
    } as never)

    const result = await requireAccountAccess(makeRequest(), ACCOUNT_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(500)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('User role not found')
  })

  it('returns 401 when auth fails', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireAccountAccess(makeRequest(), ACCOUNT_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })
})

describe('requireCategoryAccess', () => {
  it('returns 400 when categoryId is empty', async () => {
    const result = await requireCategoryAccess(makeRequest(), '')
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Invalid category ID')
  })

  it('returns 403 when category not found', async () => {
    mockDb.householdCategory.findFirst.mockResolvedValue(null as never)

    const result = await requireCategoryAccess(makeRequest(), CATEGORY_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Access denied')
  })

  it('returns category and authContext on success', async () => {
    mockDb.householdCategory.findFirst.mockResolvedValue({
      id: CATEGORY_ID,
      name: 'Food',
      household: { members: [{ role: 'OWNER' }] },
    } as never)

    const result = await requireCategoryAccess(makeRequest(), CATEGORY_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { category: unknown; authContext: unknown }
    expect(ctx.category).toBeDefined()
    expect(ctx.authContext).toBeDefined()
  })

  it('returns 401 when auth fails', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireCategoryAccess(makeRequest(), CATEGORY_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })
})

describe('requireCategoryWriteAccess', () => {
  it('returns 403 when canManageData is false', async () => {
    mockDb.householdCategory.findFirst.mockResolvedValue({
      id: CATEGORY_ID,
      household: { members: [{ role: 'VIEWER' }] },
    } as never)
    mockCanManageData.mockReturnValue(false)

    const result = await requireCategoryWriteAccess(makeRequest(), CATEGORY_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('permission to modify categories')
  })

  it('returns access result when canManageData is true', async () => {
    mockDb.householdCategory.findFirst.mockResolvedValue({
      id: CATEGORY_ID,
      household: { members: [{ role: 'OWNER' }] },
    } as never)
    mockCanManageData.mockReturnValue(true)

    const result = await requireCategoryWriteAccess(makeRequest(), CATEGORY_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { category: unknown; userRole: string }
    expect(ctx.userRole).toBe('OWNER')
  })

  it('returns 500 when membership not found', async () => {
    mockDb.householdCategory.findFirst.mockResolvedValue({
      id: CATEGORY_ID,
      household: { members: [] },
    } as never)

    const result = await requireCategoryWriteAccess(makeRequest(), CATEGORY_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(500)
  })
})

describe('requireTypeAccess', () => {
  it('returns 400 when typeId is empty', async () => {
    const result = await requireTypeAccess(makeRequest(), '')
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Invalid type ID')
  })

  it('returns 403 when type not found', async () => {
    mockDb.householdType.findFirst.mockResolvedValue(null as never)

    const result = await requireTypeAccess(makeRequest(), TYPE_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Access denied')
  })

  it('returns type and authContext on success', async () => {
    mockDb.householdType.findFirst.mockResolvedValue({
      id: TYPE_ID,
      name: 'Purchase',
      household: { members: [{ role: 'MEMBER' }] },
    } as never)

    const result = await requireTypeAccess(makeRequest(), TYPE_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { type: unknown; authContext: unknown }
    expect(ctx.type).toBeDefined()
  })

  it('returns 401 when auth fails', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireTypeAccess(makeRequest(), TYPE_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })
})

describe('requireTypeWriteAccess', () => {
  it('returns 403 when canManageData is false', async () => {
    mockDb.householdType.findFirst.mockResolvedValue({
      id: TYPE_ID,
      household: { members: [{ role: 'VIEWER' }] },
    } as never)
    mockCanManageData.mockReturnValue(false)

    const result = await requireTypeWriteAccess(makeRequest(), TYPE_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('permission to modify types')
  })

  it('returns access result when canManageData is true', async () => {
    mockDb.householdType.findFirst.mockResolvedValue({
      id: TYPE_ID,
      household: { members: [{ role: 'OWNER' }] },
    } as never)
    mockCanManageData.mockReturnValue(true)

    const result = await requireTypeWriteAccess(makeRequest(), TYPE_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { type: unknown; userRole: string }
    expect(ctx.userRole).toBe('OWNER')
  })

  it('returns 500 when membership not found', async () => {
    mockDb.householdType.findFirst.mockResolvedValue({
      id: TYPE_ID,
      household: { members: [] },
    } as never)

    const result = await requireTypeWriteAccess(makeRequest(), TYPE_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(500)
  })
})

describe('requireUserAccess', () => {
  it('returns 400 when userId is empty', async () => {
    const result = await requireUserAccess(makeRequest(), '')
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Invalid user ID')
  })

  it('returns 403 when user not found', async () => {
    mockDb.householdUser.findFirst.mockResolvedValue(null as never)

    const result = await requireUserAccess(makeRequest(), HH_USER_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('Access denied')
  })

  it('returns user, authContext, and userRole on success', async () => {
    mockDb.householdUser.findFirst.mockResolvedValue({
      id: HH_USER_ID,
      name: 'Alice',
      household: { members: [{ role: 'MEMBER' }] },
    } as never)

    const result = await requireUserAccess(makeRequest(), HH_USER_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
    const ctx = result as { user: unknown; userRole: string }
    expect(ctx.user).toBeDefined()
    expect(ctx.userRole).toBe('MEMBER')
  })

  it('returns 500 when membership not found', async () => {
    mockDb.householdUser.findFirst.mockResolvedValue({
      id: HH_USER_ID,
      household: { members: [] },
    } as never)

    const result = await requireUserAccess(makeRequest(), HH_USER_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(500)
  })

  it('returns 401 when auth fails', async () => {
    mockGetSession.mockResolvedValue(null as never)

    const result = await requireUserAccess(makeRequest(), HH_USER_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })
})

describe('requireUserWriteAccess', () => {
  it('returns 403 when canManageData is false', async () => {
    mockDb.householdUser.findFirst.mockResolvedValue({
      id: HH_USER_ID,
      household: { members: [{ role: 'VIEWER' }] },
    } as never)
    mockCanManageData.mockReturnValue(false)

    const result = await requireUserWriteAccess(makeRequest(), HH_USER_ID)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    const body = await (result as NextResponse).json()
    expect(body.error).toContain('permission to modify users')
  })

  it('returns access result when canManageData is true', async () => {
    mockDb.householdUser.findFirst.mockResolvedValue({
      id: HH_USER_ID,
      household: { members: [{ role: 'OWNER' }] },
    } as never)
    mockCanManageData.mockReturnValue(true)

    const result = await requireUserWriteAccess(makeRequest(), HH_USER_ID)
    expect(result).not.toBeInstanceOf(NextResponse)
  })
})
