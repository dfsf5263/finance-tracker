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

    // Get user's household subscriptions
    const userWithHouseholds = await db.user.findUnique({
      where: { id: userId },
      include: {
        households: {
          include: {
            household: {
              select: {
                id: true,
                name: true,
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

    // Format the response
    const subscriptions = userWithHouseholds.households.map((uh) => ({
      householdId: uh.household.id,
      householdName: uh.household.name,
      weeklySummary: uh.weeklySummary,
      role: uh.role,
    }))

    return NextResponse.json(subscriptions)
  } catch (error) {
    await logApiError({
      request: _request,
      error,
      operation: 'fetch email subscriptions',
      context: { userId },
    })
    return NextResponse.json({ error: 'Failed to fetch email subscriptions' }, { status: 500 })
  }
})

export const PUT = withApiLogging(async (request: NextRequest) => {
  // If email is not configured, prevent subscription changes
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Email is not configured for this instance' },
      { status: 400 }
    )
  }

  let userId: string | undefined
  let data: { householdId?: string; weeklySummary?: boolean } | undefined
  try {
    // Ensure user exists in database
    const authContext = await requireAuth()
    if (authContext instanceof NextResponse) return authContext
    userId = authContext.userId

    data = await request.json()
    const { householdId, weeklySummary } = data || {}

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    if (typeof weeklySummary !== 'boolean') {
      return NextResponse.json({ error: 'Weekly summary must be a boolean' }, { status: 400 })
    }

    // Verify user is a member of the household
    const userHousehold = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: householdId,
        },
      },
    })

    if (!userHousehold) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 })
    }

    // Update the email subscription preference
    await db.userHousehold.update({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: householdId,
        },
      },
      data: {
        weeklySummary: weeklySummary,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update email subscription',
      context: {
        userId,
        requestData: data,
      },
    })
    return NextResponse.json({ error: 'Failed to update email subscription' }, { status: 500 })
  }
})
