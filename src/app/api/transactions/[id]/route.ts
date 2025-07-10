import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'
import { logApiError } from '@/lib/error-logger'

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
    await logApiError({
      request,
      error,
      operation: 'fetch transaction',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body
  try {
    const { id } = await params
    body = await request.json()
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
    await logApiError({
      request,
      error,
      operation: 'update transaction',
      context: {
        id: (await params).id,
        updateData: body,
      },
    })
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
    await logApiError({
      request,
      error,
      operation: 'delete transaction',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
