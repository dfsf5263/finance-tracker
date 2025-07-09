import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
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

    const skip = (page - 1) * limit

    const where: Prisma.TransactionWhereInput = {
      householdId: householdId,
    }
    if (category) where.categoryId = category
    if (type) where.typeId = type
    if (account) where.accountId = account
    if (user) where.userId = user
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

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
    } = body

    const transaction = await db.transaction.create({
      data: {
        householdId,
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

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
