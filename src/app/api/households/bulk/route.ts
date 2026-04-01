import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { logApiError } from '@/lib/error-logger'
import { withApiLogging } from '@/lib/middleware/with-api-logging'
import { validateRequestBody, bulkHouseholdsRequestSchema } from '@/lib/validation'

export const POST = withApiLogging(async (request: NextRequest) => {
  let requestData
  try {
    const authContext = await requireAuth()
    if (authContext instanceof NextResponse) return authContext
    const userId = authContext.userId

    requestData = await request.json()
    const validation = validateRequestBody(bulkHouseholdsRequestSchema, requestData)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { households } = validation.data

    // Get existing households the user owns to avoid duplicates
    const existingHouseholds = await db.userHousehold.findMany({
      where: { userId, role: 'OWNER' },
      include: { household: { select: { name: true } } },
    })

    const existingNames = new Set(
      existingHouseholds.map((uh: { household: { name: string } }) =>
        uh.household.name.toLowerCase()
      )
    )

    // Filter out households that already exist (case-insensitive)
    const householdsToCreate = households.filter((h) => !existingNames.has(h.name.toLowerCase()))

    if (householdsToCreate.length === 0) {
      return NextResponse.json({
        message: 'All households already exist',
        created: [],
        skipped: households.length,
      })
    }

    // Create each household + UserHousehold join atomically
    const created = await db.$transaction(async (tx) => {
      const results = []
      for (const h of householdsToCreate) {
        const householdData: { name: string; annualBudget?: number | string } = {
          name: h.name,
        }
        if (h.annualBudget !== undefined && h.annualBudget !== null) {
          householdData.annualBudget = h.annualBudget
        }

        const household = await tx.household.create({ data: householdData })

        await tx.userHousehold.create({
          data: {
            userId,
            householdId: household.id,
            role: 'OWNER',
            weeklySummary: true,
          },
        })

        results.push(household)
      }
      return results
    })

    return NextResponse.json({
      message: `Successfully created ${created.length} households`,
      created,
      skipped: households.length - created.length,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create bulk households',
      context: {
        householdCount: Array.isArray(requestData?.households) ? requestData.households.length : 0,
      },
    })
    return NextResponse.json({ error: 'Failed to create households' }, { status: 500 })
  }
})
