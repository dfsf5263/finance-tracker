import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess, requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody, categoryCreateSchema } from '@/lib/validation'
import { apiRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const categories = await db.householdCategory.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
      include: { household: true },
    })
    return NextResponse.json(categories)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch categories',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let data
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    // Parse and validate request body
    data = await request.json()

    // Create extended schema for category that includes householdId and annualBudget
    const extendedSchema = categoryCreateSchema.extend({
      householdId: z.string().uuid('Invalid household ID format'),
      annualBudget: z.union([z.string(), z.number()]).optional(),
    })

    const validation = validateRequestBody(extendedSchema, data)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, description, icon, color, householdId, annualBudget } = validation.data

    // Verify user has write access to this household
    const result = await requireHouseholdWriteAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const categoryData: {
      name: string
      householdId: string
      description?: string
      icon?: string
      color?: string
      annualBudget?: string | number
    } = {
      name,
      householdId,
    }

    if (description) categoryData.description = description
    if (icon) categoryData.icon = icon
    if (color) categoryData.color = color
    if (
      annualBudget !== undefined &&
      annualBudget !== null &&
      annualBudget !== '' &&
      annualBudget !== '0'
    ) {
      categoryData.annualBudget = annualBudget
    }

    const category = await db.householdCategory.create({
      data: categoryData,
      include: { household: true },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create category',
      context: {
        householdId: data?.householdId,
        categoryName: data?.name,
      },
    })
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
