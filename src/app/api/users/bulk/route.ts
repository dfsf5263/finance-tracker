import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const POST = withApiLogging(async (request: NextRequest) => {
  let requestData
  try {
    requestData = await request.json()
    const { users, householdId } = requestData

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Users array is required' }, { status: 400 })
    }

    // Verify user has write access to this household
    const authResult = await requireHouseholdWriteAccess(request, householdId)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Get existing users for this household to avoid duplicates
    const existingUsers = await db.householdUser.findMany({
      where: { householdId },
      select: { name: true },
    })

    const existingNames = new Set(
      existingUsers.map((user: { name: string }) => user.name.toLowerCase())
    )

    // Filter out users that already exist (case-insensitive)
    const usersToCreate = users.filter(
      (user: { name: string }) => !existingNames.has(user.name.toLowerCase())
    )

    if (usersToCreate.length === 0) {
      return NextResponse.json({
        message: 'All users already exist',
        created: [],
        skipped: users.length,
      })
    }

    // Prepare users for bulk creation
    const usersWithHousehold = usersToCreate.map(
      (user: { name: string; annualBudget?: number | string }) => {
        const data: { name: string; householdId: string; annualBudget?: number | string } = {
          name: user.name,
          householdId,
        }
        if (user.annualBudget !== undefined && user.annualBudget !== null) {
          data.annualBudget = user.annualBudget
        }
        return data
      }
    )

    // Bulk create users
    const createResult = await db.householdUser.createMany({
      data: usersWithHousehold,
      skipDuplicates: true,
    })

    // Fetch the created users to return them
    const createdUsers = await db.householdUser.findMany({
      where: {
        householdId,
        name: {
          in: usersToCreate.map((user: { name: string }) => user.name),
        },
      },
    })

    return NextResponse.json({
      message: `Successfully created ${createResult.count} users`,
      created: createdUsers,
      skipped: users.length - usersToCreate.length,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create bulk users',
      context: {
        householdId: requestData?.householdId,
        userCount: Array.isArray(requestData?.users) ? requestData.users.length : 0,
      },
    })
    return NextResponse.json({ error: 'Failed to create users' }, { status: 500 })
  }
})
