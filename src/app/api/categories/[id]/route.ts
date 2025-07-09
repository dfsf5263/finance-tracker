import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const category = await db.householdCategory.findUnique({
      where: { id },
      include: { household: true },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error fetching category:', error)
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await request.json()
    const { name, annualBudget } = data

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const updateData: { name: string; annualBudget?: string | number | null } = { name }

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
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.householdCategory.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Error deleting category:', error)

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
