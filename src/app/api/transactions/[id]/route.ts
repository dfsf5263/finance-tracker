import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { logApiError } from '@/lib/error-logger'
import { requireTransactionAccess, requireTransactionWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody, transactionUpdateSchema } from '@/lib/validation'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Verify user has access to this transaction
    const result = await requireTransactionAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    const { transaction } = result
    // Transform dates to date-only format for frontend
    const transformedTransaction = {
      ...(transaction as object),
      transactionDate: (transaction as { transactionDate: Date }).transactionDate
        .toISOString()
        .split('T')[0],
      postDate: (transaction as { postDate: Date }).postDate.toISOString().split('T')[0],
    }

    return NextResponse.json(transformedTransaction)
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

    // Verify user has write access to this transaction
    const result = await requireTransactionWriteAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Access verified - user has permission to update this transaction

    // Parse and validate request body
    body = await request.json()
    const validation = validateRequestBody(transactionUpdateSchema, body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

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
    } = validation.data

    const updatedTransaction = await db.transaction.update({
      where: { id },
      data: {
        accountId,
        userId,
        transactionDate: new Date(transactionDate).toISOString(),
        postDate: new Date(postDate).toISOString(),
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

    // Transform dates to date-only format for frontend
    const transformedTransaction = {
      ...updatedTransaction,
      transactionDate: updatedTransaction.transactionDate.toISOString().split('T')[0],
      postDate: updatedTransaction.postDate.toISOString().split('T')[0],
    }

    return NextResponse.json(transformedTransaction)
  } catch (error) {
    // Check for unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Duplicate transaction detected',
          message:
            'A transaction with the same household, date, description, and amount already exists',
        },
        { status: 409 }
      )
    }

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

    // Verify user has write access to this transaction
    const result = await requireTransactionWriteAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

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
