import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireAccountAccess } from '@/lib/auth-middleware'
import { validateRequestBody, accountUpdateSchema } from '@/lib/validation'
import { apiRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params

    // Verify user has access to this account
    const result = await requireAccountAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    const { account } = result
    return NextResponse.json(account)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch account',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let requestData
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params

    // Verify user has access to this account
    const result = await requireAccountAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Parse and validate request body
    requestData = await request.json()
    const validation = validateRequestBody(accountUpdateSchema, requestData)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name } = validation.data
    const updateData: { name?: string } = {}

    if (name) updateData.name = name

    const account = await db.householdAccount.update({
      where: { id },
      data: updateData,
      include: { household: true },
    })

    return NextResponse.json(account)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update account',
      context: {
        id: (await params).id,
        updateData: requestData,
      },
    })
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
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

    // Verify user has access to this account
    const result = await requireAccountAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    await db.householdAccount.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Account deleted successfully' })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'delete account',
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
            'Cannot delete this account because it is used by existing transactions. Please delete or update all transactions using this account first.',
          errorType: 'FOREIGN_KEY_CONSTRAINT',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
