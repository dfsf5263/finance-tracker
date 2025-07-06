import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const type = await db.transactionType.findUnique({
      where: { id: params.id },
    })

    if (!type) {
      return NextResponse.json({ error: 'Transaction type not found' }, { status: 404 })
    }

    return NextResponse.json(type)
  } catch (error) {
    console.error('Error fetching transaction type:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction type' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const type = await db.transactionType.update({
      where: { id: params.id },
      data: { name },
    })

    return NextResponse.json(type)
  } catch (error) {
    console.error('Error updating transaction type:', error)
    return NextResponse.json({ error: 'Failed to update transaction type' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.transactionType.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Transaction type deleted successfully' })
  } catch (error) {
    console.error('Error deleting transaction type:', error)

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
