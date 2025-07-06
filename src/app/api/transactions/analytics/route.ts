import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'category'
    const typeId = searchParams.get('typeId')

    const where: Prisma.TransactionWhereInput = {}
    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = new Date(startDate)
      if (endDate) where.transactionDate.lte = new Date(endDate)
    }
    if (typeId) {
      where.typeId = typeId
    }

    const groupByField =
      groupBy === 'user' ? 'userId' : groupBy === 'source' ? 'sourceId' : 'categoryId'

    const aggregations = await db.transaction.groupBy({
      by: [groupByField as 'userId' | 'sourceId' | 'categoryId'],
      where,
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    })

    // Get the actual names for the IDs
    const ids = aggregations.map((item) => item[groupByField])

    let nameMap: { [key: string]: string } = {}
    if (groupBy === 'user') {
      const users = await db.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
      nameMap = Object.fromEntries(users.map((user) => [user.id, user.name]))
    } else if (groupBy === 'source') {
      const sources = await db.source.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
      nameMap = Object.fromEntries(sources.map((source) => [source.id, source.name]))
    } else {
      const categories = await db.category.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
      nameMap = Object.fromEntries(categories.map((category) => [category.id, category.name]))
    }

    const formattedData = aggregations.map((item) => ({
      name: nameMap[item[groupByField] as string] || 'Unknown',
      value: parseFloat(item._sum.amount?.toString() || '0'),
      count: item._count._all,
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
