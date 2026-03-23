import { getSession } from '@/lib/auth-helpers'
import { getAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { HouseholdRole } from '@prisma/client'
import { canManageData } from '@/lib/role-utils'

export interface AuthContext {
  userId: string
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const

/**
 * Attempt to authenticate via API key from the x-api-key header.
 * Returns an AuthContext if valid, or null if no key is present / key is invalid.
 */
async function authenticateWithApiKey(): Promise<AuthContext | null> {
  const headersList = await headers()
  const apiKeyValue = headersList.get('x-api-key')
  if (!apiKeyValue) return null

  const auth = getAuth()
  const result = await auth.api.verifyApiKey({ body: { key: apiKeyValue } })
  if (!result.valid || !result.key) return null

  const user = await db.user.findUnique({
    where: { id: result.key.referenceId },
    select: userSelect,
  })
  if (!user) return null

  return { userId: user.id, user }
}

/**
 * Middleware to verify user authentication.
 * Checks session cookies first, then falls back to API key (x-api-key header).
 * Returns the authenticated user context or an error response.
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  // 1. Try session-based auth
  const session = await getSession()
  const userId = session?.user?.id

  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: userSelect,
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User account not properly synced. Please sign out and sign back in.' },
        { status: 401 }
      )
    }

    return { userId, user }
  }

  // 2. Fall back to API key auth
  const apiKeyAuth = await authenticateWithApiKey()
  if (apiKeyAuth) return apiKeyAuth

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Middleware to verify user has access to a specific household
 * Returns the household and user context or an error response
 */
export async function requireHouseholdAccess(
  request: NextRequest,
  householdId: string
): Promise<{ authContext: AuthContext; userRole: HouseholdRole } | NextResponse> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  // Validate household ID format
  if (!householdId || typeof householdId !== 'string') {
    return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 })
  }

  // Verify user has access to this household and get their role
  const userHousehold = await db.userHousehold.findFirst({
    where: {
      householdId,
      user: {
        id: authResult.userId,
      },
    },
    include: {
      household: {
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!userHousehold) {
    return NextResponse.json(
      { error: 'Access denied. You do not have permission to access this household.' },
      { status: 403 }
    )
  }

  return {
    authContext: authResult,
    userRole: userHousehold.role,
  }
}

/**
 * Middleware to verify user has write access to a specific household
 * Returns the household and user context or an error response
 */
export async function requireHouseholdWriteAccess(
  request: NextRequest,
  householdId: string
): Promise<{ authContext: AuthContext; userRole: HouseholdRole } | NextResponse> {
  const accessResult = await requireHouseholdAccess(request, householdId)

  if (accessResult instanceof NextResponse) {
    return accessResult
  }

  // Check if user has write permissions
  if (!canManageData(accessResult.userRole)) {
    return NextResponse.json(
      { error: 'You do not have permission to modify data in this household' },
      { status: 403 }
    )
  }

  return accessResult
}

/**
 * Middleware to verify user has access to a specific transaction
 * Returns the transaction and user context or an error response
 */
export async function requireTransactionAccess(
  request: NextRequest,
  transactionId: string
): Promise<
  { transaction: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse
> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  // Validate transaction ID format
  if (!transactionId || typeof transactionId !== 'string') {
    return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
  }

  // Find transaction and verify user has access via household membership
  const transaction = await db.transaction.findFirst({
    where: {
      id: transactionId,
      household: {
        members: {
          some: {
            user: {
              id: authResult.userId,
            },
          },
        },
      },
    },
    include: {
      account: true,
      user: true,
      category: true,
      type: true,
      household: {
        include: {
          members: {
            where: {
              user: {
                id: authResult.userId,
              },
            },
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!transaction) {
    return NextResponse.json(
      { error: 'Access denied. You do not have permission to access this transaction.' },
      { status: 403 }
    )
  }

  // Get user's role for this household
  const householdWithMembers = transaction as {
    household: { members: Array<{ role: HouseholdRole }> }
  }
  const userMembership = householdWithMembers.household.members[0]
  if (!userMembership) {
    return NextResponse.json({ error: 'User role not found' }, { status: 500 })
  }

  return {
    transaction,
    authContext: authResult,
    userRole: userMembership.role,
  }
}

/**
 * Middleware to verify user has write access to a specific transaction
 * Returns the transaction and user context or an error response
 */
export async function requireTransactionWriteAccess(
  request: NextRequest,
  transactionId: string
): Promise<
  { transaction: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse
> {
  const accessResult = await requireTransactionAccess(request, transactionId)

  if (accessResult instanceof NextResponse) {
    return accessResult
  }

  // Check if user has write permissions
  if (!canManageData(accessResult.userRole)) {
    return NextResponse.json(
      { error: 'You do not have permission to modify transactions in this household' },
      { status: 403 }
    )
  }

  return accessResult
}

/**
 * Middleware to verify user has access to a specific account
 * Returns the account and user context or an error response
 */
export async function requireAccountAccess(
  request: NextRequest,
  accountId: string
): Promise<{ account: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  // Validate account ID format
  if (!accountId || typeof accountId !== 'string') {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
  }

  // Find account and verify user has access via household membership
  const account = await db.householdAccount.findFirst({
    where: {
      id: accountId,
      household: {
        members: {
          some: {
            user: {
              id: authResult.userId,
            },
          },
        },
      },
    },
    include: {
      household: {
        include: {
          members: {
            where: {
              user: {
                id: authResult.userId,
              },
            },
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!account) {
    return NextResponse.json(
      { error: 'Access denied. You do not have permission to access this account.' },
      { status: 403 }
    )
  }

  // Get user's role for this household
  const accountWithMembers = account as {
    household: { members: Array<{ role: HouseholdRole }> }
  }
  const userMembership = accountWithMembers.household.members[0]
  if (!userMembership) {
    return NextResponse.json({ error: 'User role not found' }, { status: 500 })
  }

  return {
    account,
    authContext: authResult,
    userRole: userMembership.role,
  }
}

/**
 * Middleware to verify user has write access to a specific account
 * Returns the account and user context or an error response
 */
export async function requireAccountWriteAccess(
  request: NextRequest,
  accountId: string
): Promise<{ account: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse> {
  const accessResult = await requireAccountAccess(request, accountId)

  if (accessResult instanceof NextResponse) {
    return accessResult
  }

  // Check if user has write permissions
  if (!canManageData(accessResult.userRole)) {
    return NextResponse.json(
      { error: 'You do not have permission to modify accounts in this household' },
      { status: 403 }
    )
  }

  return accessResult
}

/**
 * Middleware to verify user has access to a specific category
 * Returns the category and user context or an error response
 */
export async function requireCategoryAccess(
  request: NextRequest,
  categoryId: string
): Promise<{ category: unknown; authContext: AuthContext } | NextResponse> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  // Validate category ID format
  if (!categoryId || typeof categoryId !== 'string') {
    return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 })
  }

  // Find category and verify user has access via household membership
  const category = await db.householdCategory.findFirst({
    where: {
      id: categoryId,
      household: {
        members: {
          some: {
            user: {
              id: authResult.userId,
            },
          },
        },
      },
    },
    include: {
      household: {
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!category) {
    return NextResponse.json(
      { error: 'Access denied. You do not have permission to access this category.' },
      { status: 403 }
    )
  }

  return {
    category,
    authContext: authResult,
  }
}

/**
 * Middleware to verify user has access to a specific type
 * Returns the type and user context or an error response
 */
export async function requireTypeAccess(
  request: NextRequest,
  typeId: string
): Promise<{ type: unknown; authContext: AuthContext } | NextResponse> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  // Validate type ID format
  if (!typeId || typeof typeId !== 'string') {
    return NextResponse.json({ error: 'Invalid type ID' }, { status: 400 })
  }

  // Find type and verify user has access via household membership
  const type = await db.householdType.findFirst({
    where: {
      id: typeId,
      household: {
        members: {
          some: {
            user: {
              id: authResult.userId,
            },
          },
        },
      },
    },
    include: {
      household: {
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!type) {
    return NextResponse.json(
      { error: 'Access denied. You do not have permission to access this type.' },
      { status: 403 }
    )
  }

  return {
    type,
    authContext: authResult,
  }
}

/**
 * Middleware to verify user has write access to a specific type
 * Returns the type and user context or an error response
 */
export async function requireTypeWriteAccess(
  request: NextRequest,
  typeId: string
): Promise<{ type: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse> {
  const accessResult = await requireTypeAccess(request, typeId)

  if (accessResult instanceof NextResponse) {
    return accessResult
  }

  const typeWithMembers = accessResult.type as {
    household: { members: Array<{ role: HouseholdRole }> }
  }
  const userMembership = typeWithMembers.household.members[0]
  if (!userMembership) {
    return NextResponse.json({ error: 'User role not found' }, { status: 500 })
  }

  if (!canManageData(userMembership.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to modify types in this household' },
      { status: 403 }
    )
  }

  return {
    type: accessResult.type,
    authContext: accessResult.authContext,
    userRole: userMembership.role,
  }
}

/**
 * Middleware to verify user has write access to a specific category
 * Returns the category and user context or an error response
 */
export async function requireCategoryWriteAccess(
  request: NextRequest,
  categoryId: string
): Promise<
  { category: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse
> {
  const accessResult = await requireCategoryAccess(request, categoryId)

  if (accessResult instanceof NextResponse) {
    return accessResult
  }

  const categoryWithMembers = accessResult.category as {
    household: { members: Array<{ role: HouseholdRole }> }
  }
  const userMembership = categoryWithMembers.household.members[0]
  if (!userMembership) {
    return NextResponse.json({ error: 'User role not found' }, { status: 500 })
  }

  if (!canManageData(userMembership.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to modify categories in this household' },
      { status: 403 }
    )
  }

  return {
    category: accessResult.category,
    authContext: accessResult.authContext,
    userRole: userMembership.role,
  }
}

/**
 * Middleware to verify user has access to a specific household user
 * Returns the user and user context or an error response
 */
export async function requireUserAccess(
  request: NextRequest,
  userId: string
): Promise<{ user: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  // Validate user ID format
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  // Find user and verify user has access via household membership
  const user = await db.householdUser.findFirst({
    where: {
      id: userId,
      household: {
        members: {
          some: {
            user: {
              id: authResult.userId,
            },
          },
        },
      },
    },
    include: {
      household: {
        include: {
          members: {
            where: {
              user: {
                id: authResult.userId,
              },
            },
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'Access denied. You do not have permission to access this user.' },
      { status: 403 }
    )
  }

  // Get user's role for this household
  const userWithMembers = user as {
    household: { members: Array<{ role: HouseholdRole }> }
  }
  const userMembership = userWithMembers.household.members[0]
  if (!userMembership) {
    return NextResponse.json({ error: 'User role not found' }, { status: 500 })
  }

  return {
    user,
    authContext: authResult,
    userRole: userMembership.role,
  }
}

/**
 * Middleware to verify user has write access to a specific household user
 * Returns the user and user context or an error response
 */
export async function requireUserWriteAccess(
  request: NextRequest,
  userId: string
): Promise<{ user: unknown; authContext: AuthContext; userRole: HouseholdRole } | NextResponse> {
  const accessResult = await requireUserAccess(request, userId)

  if (accessResult instanceof NextResponse) {
    return accessResult
  }

  // Check if user has write permissions
  if (!canManageData(accessResult.userRole)) {
    return NextResponse.json(
      { error: 'You do not have permission to modify users in this household' },
      { status: 403 }
    )
  }

  return accessResult
}
