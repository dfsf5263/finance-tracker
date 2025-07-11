import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface AuthContext {
  userId: string
  user: {
    id: string
    clerkUserId: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

/**
 * Middleware to verify user authentication
 * Returns the authenticated user context or an error response
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user from database
  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      clerkUserId: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return {
    userId,
    user,
  }
}

/**
 * Middleware to verify user has access to a specific household
 * Returns the household and user context or an error response
 */
export async function requireHouseholdAccess(
  request: NextRequest,
  householdId: string
): Promise<{ household: unknown; authContext: AuthContext } | NextResponse> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  // Validate household ID format
  if (!householdId || typeof householdId !== 'string') {
    return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 })
  }

  // Verify user has access to this household
  const household = await db.household.findFirst({
    where: {
      id: householdId,
      members: {
        some: {
          user: {
            clerkUserId: authResult.userId,
          },
        },
      },
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!household) {
    return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 })
  }

  return {
    household,
    authContext: authResult,
  }
}

/**
 * Middleware to verify user has access to a specific transaction
 * Returns the transaction and user context or an error response
 */
export async function requireTransactionAccess(
  request: NextRequest,
  transactionId: string
): Promise<{ transaction: unknown; authContext: AuthContext } | NextResponse> {
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
              clerkUserId: authResult.userId,
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
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 })
  }

  return {
    transaction,
    authContext: authResult,
  }
}

/**
 * Middleware to verify user has access to a specific account
 * Returns the account and user context or an error response
 */
export async function requireAccountAccess(
  request: NextRequest,
  accountId: string
): Promise<{ account: unknown; authContext: AuthContext } | NextResponse> {
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
              clerkUserId: authResult.userId,
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

  if (!account) {
    return NextResponse.json({ error: 'Account not found or access denied' }, { status: 404 })
  }

  return {
    account,
    authContext: authResult,
  }
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
              clerkUserId: authResult.userId,
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
    return NextResponse.json({ error: 'Category not found or access denied' }, { status: 404 })
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
              clerkUserId: authResult.userId,
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
    return NextResponse.json({ error: 'Type not found or access denied' }, { status: 404 })
  }

  return {
    type,
    authContext: authResult,
  }
}
