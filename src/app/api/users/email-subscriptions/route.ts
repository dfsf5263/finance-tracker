import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { logApiError } from '@/lib/error-logger'

export async function GET() {
  let user: { id: string } | undefined
  try {
    // Ensure user exists in database
    const userResult = await ensureUser()
    user = userResult.user

    // Get user's household subscriptions
    const userWithHouseholds = await db.user.findUnique({
      where: { id: user.id },
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
      request: new Request('http://localhost/api/users/email-subscriptions', {
        method: 'GET',
      }) as NextRequest,
      error,
      operation: 'fetch email subscriptions',
      context: { userId: user?.id },
    })
    return NextResponse.json({ error: 'Failed to fetch email subscriptions' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  let user: { id: string } | undefined
  let data: { householdId?: string; weeklySummary?: boolean } | undefined
  try {
    // Ensure user exists in database
    const userResult = await ensureUser()
    user = userResult.user

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
          userId: user.id,
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
          userId: user.id,
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
        userId: user?.id,
        requestData: data,
      },
    })
    return NextResponse.json({ error: 'Failed to update email subscription' }, { status: 500 })
  }
}
