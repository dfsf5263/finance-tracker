import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const account = await db.householdAccount.findUnique({
      where: { id },
      include: { household: true },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

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
    const { id } = await params
    requestData = await request.json()
    const { name } = requestData

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const account = await db.householdAccount.update({
      where: { id },
      data: { name },
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
    const { id } = await params
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
