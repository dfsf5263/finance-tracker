import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
import { validateRequestBody, householdUpdateSchema } from '@/lib/validation'
import { z } from 'zod'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Get additional count data
    const householdWithCounts = await db.household.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            accounts: true,
            users: true,
            categories: true,
            types: true,
          },
        },
      },
    })

    return NextResponse.json(householdWithCounts)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch household',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to fetch household' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let data
  try {
    const { id } = await params

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Parse and validate request body
    data = await request.json()

    // Create extended schema for household update that includes annualBudget
    const extendedSchema = householdUpdateSchema.extend({
      annualBudget: z.union([z.string(), z.number(), z.null()]).optional(),
    })

    const validation = validateRequestBody(extendedSchema, data)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, annualBudget } = validation.data
    const updateData: { name?: string; annualBudget?: string | number | null } = {}

    if (name) {
      updateData.name = name
    }

    // Handle annualBudget: allow null to clear, otherwise set value
    if (annualBudget === null || annualBudget === '') {
      updateData.annualBudget = null
    } else if (annualBudget !== undefined) {
      updateData.annualBudget = annualBudget
    }

    const household = await db.household.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            accounts: true,
            users: true,
            categories: true,
            types: true,
          },
        },
      },
    })

    return NextResponse.json(household)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update household',
      context: {
        id: (await params).id,
        updateData: data,
      },
    })
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Check if household has any transactions
    const transactionCount = await db.transaction.count({
      where: { householdId: id },
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete this household because it has existing transactions. Please delete all transactions first.',
          errorType: 'HAS_TRANSACTIONS',
        },
        { status: 409 }
      )
    }

    await db.household.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Household deleted successfully' })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'delete household',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 })
  }
}
