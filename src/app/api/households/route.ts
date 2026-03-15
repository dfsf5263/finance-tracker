import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { logApiError } from '@/lib/error-logger'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const GET = withApiLogging(async (_request: NextRequest) => {
  let userId: string | undefined
  try {
    // Ensure user exists in database
    const authContext = await requireAuth()
    if (authContext instanceof NextResponse) return authContext
    userId = authContext.userId

    // Get user with households
    const userWithHouseholds = await db.user.findUnique({
      where: { id: userId },
      include: {
        households: {
          include: {
            household: {
              include: {
                _count: {
                  select: {
                    accounts: true,
                    users: true,
                    categories: true,
                    types: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!userWithHouseholds) {
      return NextResponse.json(
        {
          error: 'User account not properly synced. Please sign out and sign back in.',
        },
        { status: 401 }
      )
    }

    // Return only households the user has access to
    const households = userWithHouseholds.households.map((uh) => ({
      ...uh.household,
      userRole: uh.role,
    }))

    return NextResponse.json(households)
  } catch (error) {
    await logApiError({
      request: _request,
      error,
      operation: 'fetch households',
      context: { userId },
    })
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 })
  }
})

export const POST = withApiLogging(async (request: NextRequest) => {
  let userId: string | undefined
  let data: { name?: string; annualBudget?: string | number } | undefined
  try {
    // Ensure user exists in database
    const authContext = await requireAuth()
    if (authContext instanceof NextResponse) return authContext
    userId = authContext.userId

    data = await request.json()
    const { name, annualBudget } = data || {}

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const householdData: { name: string; annualBudget?: string | number } = { name }

    if (annualBudget !== undefined && annualBudget !== null && annualBudget !== '') {
      householdData.annualBudget = annualBudget
    }

    // Create household and user-household relationship in a transaction
    const householdResult = await db.$transaction(async (tx) => {
      // Create the household
      const household = await tx.household.create({
        data: householdData,
      })

      // Create the user-household relationship with OWNER role
      await tx.userHousehold.create({
        data: {
          userId: userId!,
          householdId: household.id,
          role: 'OWNER',
          weeklySummary: true,
        },
      })

      // Return household with counts
      return tx.household.findUnique({
        where: { id: household.id },
        include: {
          _count: {
            select: {
              accounts: true,
              users: true,
              categories: true,
              types: true,
            },
          },
        },
      })
    })

    return NextResponse.json(householdResult, { status: 201 })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create household',
      context: {
        userId,
        householdData: data,
      },
    })
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 })
  }
})
