import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  let requestData
  try {
    requestData = await request.json()
    const { categories, householdId } = requestData

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: 'Categories array is required' }, { status: 400 })
    }

    // Verify user has access to this household
    const authResult = await requireHouseholdAccess(request, householdId)
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

    // Filter out categories that already exist (case-insensitive)
    const categoriesToCreate = categories.filter(
      (category: { name: string }) => !existingNames.has(category.name.toLowerCase())
    )

    if (categoriesToCreate.length === 0) {
      return NextResponse.json({
        message: 'All categories already exist',
        created: [],
        skipped: categories.length,
      })
    }

    // Prepare categories for bulk creation
    const categoriesWithHousehold = categoriesToCreate.map((category: { name: string }) => ({
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
          in: categoriesToCreate.map((cat: { name: string }) => cat.name),
        },
      },
    })

    return NextResponse.json({
      message: `Successfully created ${createResult.count} categories`,
      created: createdCategories,
      skipped: categories.length - categoriesToCreate.length,
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
}
