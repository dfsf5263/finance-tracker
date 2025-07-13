import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess, requireUserWriteAccess } from '@/lib/auth-middleware'
import { apiRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params
    const user = await db.householdUser.findUnique({
      where: { id },
      include: { household: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, user.householdId)
    if (result instanceof NextResponse) {
      return result
    }

    return NextResponse.json(user)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch user',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let data
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params
    data = await request.json()
    const { name, annualBudget } = data

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Verify user has write access to this user
    const result = await requireUserWriteAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    const updateData: { name: string; annualBudget?: string | number | null } = { name }

    // Handle annualBudget: allow null to clear, otherwise set value
    if (annualBudget === null || annualBudget === '') {
      updateData.annualBudget = null
    } else if (annualBudget !== undefined) {
      updateData.annualBudget = annualBudget
    }

    const user = await db.householdUser.update({
      where: { id },
      data: updateData,
      include: { household: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update user',
      context: {
        id: (await params).id,
        updateData: data,
      },
    })
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
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

    // Verify user has write access to this user
    const result = await requireUserWriteAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    await db.householdUser.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'delete user',
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
            'Cannot delete this user because it is used by existing transactions. Please delete or update all transactions using this user first.',
          errorType: 'FOREIGN_KEY_CONSTRAINT',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
