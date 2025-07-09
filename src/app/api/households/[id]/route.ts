import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const household = await db.household.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            accounts: true,
            users: true,
            categories: true,
            types: true,
            transactions: true,
          },
        },
      },
    })

    if (!household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 })
    }

    return NextResponse.json(household)
  } catch (error) {
    console.error('Error fetching household:', error)
    return NextResponse.json({ error: 'Failed to fetch household' }, { status: 500 })
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
            transactions: true,
          },
        },
      },
    })

    return NextResponse.json(household)
  } catch (error) {
    console.error('Error updating household:', error)
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check if household has any transactions
    const transactionCount = await db.transaction.count({
      where: { householdId: id },
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete this household because it has existing transactions. Please delete all transactions first.',
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
    console.error('Error deleting household:', error)
    return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 })
  }
}