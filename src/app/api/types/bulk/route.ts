import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { withApiLogging } from '@/lib/middleware/with-api-logging'
import { validateRequestBody, bulkTypesRequestSchema } from '@/lib/validation'

export const POST = withApiLogging(async (request: NextRequest) => {
  let requestData
  try {
    requestData = await request.json()

    const validation = validateRequestBody(bulkTypesRequestSchema, requestData)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { types, householdId } = validation.data

    // Verify user has write access to this household
    const authResult = await requireHouseholdWriteAccess(request, householdId)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Get existing types for this household to avoid duplicates
    const existingTypes = await db.householdType.findMany({
      where: { householdId },
      select: { name: true },
    })

    const existingNames = new Set(
      existingTypes.map((type: { name: string }) => type.name.toLowerCase())
    )

    // Filter out types that already exist (case-insensitive)
    const typesToCreate = types.filter((type) => !existingNames.has(type.name.toLowerCase()))

    if (typesToCreate.length === 0) {
      return NextResponse.json({
        message: 'All types already exist',
        created: [],
        skipped: types.length,
      })
    }

    // Prepare types for bulk creation
    const typesWithHousehold = typesToCreate.map((type) => ({
      name: type.name,
      isOutflow: type.isOutflow,
      householdId,
    }))

    // Bulk create types
    const createResult = await db.householdType.createMany({
      data: typesWithHousehold,
      skipDuplicates: true,
    })

    // Fetch the created types to return them
    const createdTypes = await db.householdType.findMany({
      where: {
        householdId,
        name: {
          in: typesToCreate.map((type) => type.name),
        },
      },
    })

    return NextResponse.json({
      message: `Successfully created ${createResult.count} types`,
      created: createdTypes,
      skipped: types.length - typesToCreate.length,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create bulk types',
      context: {
        householdId: requestData?.householdId,
        typeCount: Array.isArray(requestData?.types) ? requestData.types.length : 0,
      },
    })
    return NextResponse.json({ error: 'Failed to create types' }, { status: 500 })
  }
})
