import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireCategoryAccess } from '@/lib/auth-middleware'
import { validateRequestBody, categoryUpdateSchema } from '@/lib/validation'
import { apiRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params

    // Verify user has access to this category
    const result = await requireCategoryAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    const { category } = result
    return NextResponse.json(category)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch category',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let data
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params

    // Verify user has access to this category
    const result = await requireCategoryAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Parse and validate request body
    data = await request.json()

    // Create extended schema for category update that includes annualBudget
    const extendedSchema = categoryUpdateSchema.extend({
      annualBudget: z.union([z.string(), z.number(), z.null()]).optional(),
    })

    const validation = validateRequestBody(extendedSchema, data)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, description, icon, color, annualBudget } = validation.data
    const updateData: {
      name?: string
      description?: string
      icon?: string
      color?: string
      annualBudget?: string | number | null
    } = {}

    if (name) updateData.name = name
    if (description) updateData.description = description
    if (icon) updateData.icon = icon
    if (color) updateData.color = color

    // Handle annualBudget: allow null to clear, otherwise set value
    if (annualBudget === null || annualBudget === '') {
      updateData.annualBudget = null
    } else if (annualBudget !== undefined) {
      updateData.annualBudget = annualBudget
    }

    const category = await db.householdCategory.update({
      where: { id },
      data: updateData,
      include: { household: true },
    })

    return NextResponse.json(category)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update category',
      context: {
        id: (await params).id,
        updateData: data,
      },
    })
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params

    // Verify user has access to this category
    const result = await requireCategoryAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    await db.householdCategory.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'delete category',
      context: { id: (await params).id },
    })

    // Check if it's a foreign key constraint error
    if (
      error instanceof Error &&
      (('code' in error && error.code === 'P2003') ||
        error.message?.includes('foreign key constraint'))
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot delete this category because it is used by existing transactions. Please delete or update all transactions using this category first.',
          errorType: 'FOREIGN_KEY_CONSTRAINT',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
