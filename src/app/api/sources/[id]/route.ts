import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const source = await db.source.findUnique({
      where: { id: params.id },
    })

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    return NextResponse.json(source)
  } catch (error) {
    console.error('Error fetching source:', error)
    return NextResponse.json({ error: 'Failed to fetch source' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const source = await db.source.update({
      where: { id: params.id },
      data: { name },
    })

    return NextResponse.json(source)
  } catch (error) {
    console.error('Error updating source:', error)
    return NextResponse.json({ error: 'Failed to update source' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.source.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Source deleted successfully' })
  } catch (error) {
    console.error('Error deleting source:', error)

    // Check if it's a foreign key constraint error
    if (
      error instanceof Error &&
      (('code' in error && error.code === 'P2003') ||
        error.message?.includes('foreign key constraint'))
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot delete this source because it is used by existing transactions. Please delete or update all transactions using this source first.',
          errorType: 'FOREIGN_KEY_CONSTRAINT',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
  }
}
