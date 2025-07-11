import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
import { apiRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params
    const type = await db.householdType.findUnique({
      where: { id },
      include: { household: true },
    })

    if (!type) {
      return NextResponse.json({ error: 'Transaction type not found' }, { status: 404 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, type.householdId)
    if (result instanceof NextResponse) {
      return result
    }

    return NextResponse.json(type)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch transaction type',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to fetch transaction type' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let requestData
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params
    requestData = await request.json()
    const { name, isOutflow } = requestData

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // First fetch the type to get the householdId for authorization
    const existingType = await db.householdType.findUnique({
      where: { id },
      select: { householdId: true },
    })

    if (!existingType) {
      return NextResponse.json({ error: 'Transaction type not found' }, { status: 404 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, existingType.householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const updateData: { name: string; isOutflow?: boolean } = { name }
    if (isOutflow !== undefined) {
      updateData.isOutflow = isOutflow
    }

    const type = await db.householdType.update({
      where: { id },
      data: updateData,
      include: { household: true },
    })

    return NextResponse.json(type)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update transaction type',
      context: {
        id: (await params).id,
        updateData: requestData,
      },
    })
    return NextResponse.json({ error: 'Failed to update transaction type' }, { status: 500 })
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

    // First fetch the type to get the householdId for authorization
    const existingType = await db.householdType.findUnique({
      where: { id },
      select: { householdId: true },
    })

    if (!existingType) {
      return NextResponse.json({ error: 'Transaction type not found' }, { status: 404 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, existingType.householdId)
    if (result instanceof NextResponse) {
      return result
    }

    await db.householdType.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Transaction type deleted successfully' })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'delete transaction type',
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
            'Cannot delete this transaction type because it is used by existing transactions. Please delete or update all transactions using this type first.',
          errorType: 'FOREIGN_KEY_CONSTRAINT',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to delete transaction type' }, { status: 500 })
  }
}
