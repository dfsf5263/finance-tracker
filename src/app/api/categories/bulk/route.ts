import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { withApiLogging } from '@/lib/middleware/with-api-logging'
import { validateRequestBody, bulkCategoriesRequestSchema } from '@/lib/validation'

export const POST = withApiLogging(async (request: NextRequest) => {
  let requestData
  try {
    requestData = await request.json()

    const validation = validateRequestBody(bulkCategoriesRequestSchema, requestData)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { categories, householdId } = validation.data

    // Verify user has write access to this household
    const authResult = await requireHouseholdWriteAccess(request, householdId)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Get existing categories for this household to avoid duplicates
    const existingCategories = await db.householdCategory.findMany({
      where: { householdId },
      select: { name: true },
    })

    const existingNames = new Set(
      existingCategories.map((cat: { name: string }) => cat.name.toLowerCase())
    )

    // De-dupe incoming categories by name (case-insensitive), keeping first occurrence
    const seenInRequest = new Set<string>()
    const uniqueCategories = categories.filter((category) => {
      const key = category.name.toLowerCase()
      if (seenInRequest.has(key)) return false
      seenInRequest.add(key)
      return true
    })

    // Filter out categories that already exist in the DB (case-insensitive)
    const categoriesToCreate = uniqueCategories.filter(
      (category) => !existingNames.has(category.name.toLowerCase())
    )

    if (categoriesToCreate.length === 0) {
      return NextResponse.json({
        message: 'All categories already exist',
        created: [],
        skipped: categories.length,
      })
    }

    // Prepare categories for bulk creation
    const categoriesWithHousehold = categoriesToCreate.map((category) => ({
      name: category.name,
      householdId,
    }))

    // Bulk create categories
    const createResult = await db.householdCategory.createMany({
      data: categoriesWithHousehold,
      skipDuplicates: true,
    })

    // Fetch the created categories to return them
    const createdCategories = await db.householdCategory.findMany({
      where: {
        householdId,
        name: {
          in: categoriesToCreate.map((cat) => cat.name),
        },
      },
    })

    return NextResponse.json({
      message: `Successfully created ${createResult.count} categories`,
      created: createdCategories,
      skipped: categories.length - createResult.count,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create bulk categories',
      context: {
        householdId: requestData?.householdId,
        categoryCount: Array.isArray(requestData?.categories) ? requestData.categories.length : 0,
      },
    })
    return NextResponse.json({ error: 'Failed to create categories' }, { status: 500 })
  }
})
