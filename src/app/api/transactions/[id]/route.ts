import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const transaction = await db.transaction.findUnique({
      where: { id },
      include: {
        account: true,
        user: true,
        category: true,
        type: true,
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      accountId,
      userId,
      transactionDate,
      postDate,
      description,
      categoryId,
      typeId,
      amount,
      memo,
    } = body

    const transaction = await db.transaction.update({
      where: { id },
      data: {
        accountId,
        userId,
        transactionDate: new Date(transactionDate),
        postDate: new Date(postDate),
        description,
        categoryId,
        typeId,
        amount: new Decimal(amount),
        memo,
      },
      include: {
        account: true,
        user: true,
        category: true,
        type: true,
      },
    })

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.transaction.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
