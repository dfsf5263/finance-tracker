import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { withApiLogging } from '@/lib/middleware/with-api-logging'
import { validateRequestBody, bulkUsersRequestSchema } from '@/lib/validation'

export const POST = withApiLogging(async (request: NextRequest) => {
  let requestData
  try {
    requestData = await request.json()

    const validation = validateRequestBody(bulkUsersRequestSchema, requestData)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { users, householdId } = validation.data

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

    // De-dupe incoming users by name (case-insensitive), keeping first occurrence
    const seenInRequest = new Set<string>()
    const uniqueUsers = users.filter((user) => {
      const key = user.name.toLowerCase()
      if (seenInRequest.has(key)) return false
      seenInRequest.add(key)
      return true
    })

    // Filter out users that already exist in the DB (case-insensitive)
    const usersToCreate = uniqueUsers.filter((user) => !existingNames.has(user.name.toLowerCase()))

    if (usersToCreate.length === 0) {
      return NextResponse.json({
        message: 'All users already exist',
        created: [],
        skipped: users.length,
      })
    }

    // Prepare users for bulk creation
    const usersWithHousehold = usersToCreate.map((user) => {
      const data: { name: string; householdId: string; annualBudget?: number | string } = {
        name: user.name,
        householdId,
      }
      if (user.annualBudget !== undefined && user.annualBudget !== null) {
        data.annualBudget = user.annualBudget
      }
      return data
    })

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
          in: usersToCreate.map((user) => user.name),
        },
      },
    })

    return NextResponse.json({
      message: `Successfully created ${createResult.count} users`,
      created: createdUsers,
      skipped: users.length - createResult.count,
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
