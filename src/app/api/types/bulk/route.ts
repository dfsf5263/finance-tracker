import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'

export async function POST(request: NextRequest) {
  let requestData
  try {
    requestData = await request.json()
    const { types, householdId } = requestData

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    if (!Array.isArray(types) || types.length === 0) {
      return NextResponse.json({ error: 'Types array is required' }, { status: 400 })
    }

    // Validate household exists
    const household = await db.household.findUnique({
      where: { id: householdId },
    })

    if (!household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 })
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
    const typesToCreate = types.filter(
      (type: { name: string }) => !existingNames.has(type.name.toLowerCase())
    )

    if (typesToCreate.length === 0) {
      return NextResponse.json({
        message: 'All types already exist',
        created: [],
        skipped: types.length,
      })
    }

    // Prepare types for bulk creation
    const typesWithHousehold = typesToCreate.map((type: { name: string; isOutflow: boolean }) => ({
      name: type.name,
      isOutflow: type.isOutflow,
      householdId,
    }))

    // Bulk create types
    const result = await db.householdType.createMany({
      data: typesWithHousehold,
      skipDuplicates: true,
    })

    // Fetch the created types to return them
    const createdTypes = await db.householdType.findMany({
      where: {
        householdId,
        name: {
          in: typesToCreate.map((type: { name: string }) => type.name),
        },
      },
    })

    return NextResponse.json({
      message: `Successfully created ${result.count} types`,
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
}
