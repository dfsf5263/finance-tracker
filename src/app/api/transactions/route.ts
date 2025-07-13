import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess, requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody, transactionCreateSchema } from '@/lib/validation'
import { apiRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    // Apply api rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const householdId = searchParams.get('householdId')
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const account = searchParams.get('account')
    const user = searchParams.get('user')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const skip = (page - 1) * limit

    const where: Prisma.TransactionWhereInput = {
      householdId: householdId,
    }
    if (category) where.categoryId = category
    if (type) where.typeId = type
    if (account) where.accountId = account
    if (user) {
      if (user === '__household__') {
        where.userId = null
      } else {
        where.userId = user
      }
    }
    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = new Date(startDate)
      if (endDate) where.transactionDate.lte = new Date(endDate)
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          account: true,
          user: true,
          category: true,
          type: true,
        },
      }),
      db.transaction.count({ where }),
    ])

    // Transform dates to date-only format for frontend
    const transformedTransactions = transactions.map((transaction) => ({
      ...transaction,
      transactionDate: transaction.transactionDate.toISOString().split('T')[0],
      postDate: transaction.postDate.toISOString().split('T')[0],
    }))

    return NextResponse.json({
      transactions: transformedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch transactions',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    // Parse and validate request body
    body = await request.json()
    const validation = validateRequestBody(transactionCreateSchema, body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const {
      householdId,
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

    // Verify user has write access to this household
    const result = await requireHouseholdWriteAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const transaction = await db.transaction.create({
      data: {
        householdId,
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
      ...transaction,
      transactionDate: transaction.transactionDate.toISOString().split('T')[0],
      postDate: transaction.postDate.toISOString().split('T')[0],
    }

    return NextResponse.json(transformedTransaction, { status: 201 })
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
      operation: 'create transaction',
      context: {
        householdId: body.householdId,
        accountId: body.accountId,
        userId: body.userId,
        categoryId: body.categoryId,
        typeId: body.typeId,
        amount: body.amount,
      },
    })
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
