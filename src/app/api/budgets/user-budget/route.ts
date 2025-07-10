import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logApiError } from '@/lib/error-logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const householdId = searchParams.get('householdId')
    const userId = searchParams.get('userId')
    const timePeriodType = searchParams.get('timePeriodType') || 'month' // month, quarter, year
    const includeInflow = searchParams.get('includeInflow') === 'true'

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Fetch user with budget
    const user = await db.householdUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        annualBudget: true,
        householdId: true,
      },
    })

    if (!user || user.householdId !== householdId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.annualBudget) {
      return NextResponse.json({ noBudget: true })
    }

    // Calculate period budget divisor
    const getPeriodBudgetDivisor = (timePeriodType: string): number => {
      switch (timePeriodType) {
        case 'month':
          return 12
        case 'quarter':
          return 4
        case 'year':
          return 1
        default:
          return 12
      }
    }

    const budgetDivisor = getPeriodBudgetDivisor(timePeriodType)
    const userAnnualBudget = parseFloat(user.annualBudget.toString())
    const basePeriodBudget = userAnnualBudget / budgetDivisor

    // Build base transaction filter
    const baseTransactionWhere: Prisma.TransactionWhereInput = {
      householdId: householdId,
      userId: userId,
    }

    if (startDate || endDate) {
      baseTransactionWhere.transactionDate = {}
      if (startDate) baseTransactionWhere.transactionDate.gte = new Date(startDate)
      if (endDate) baseTransactionWhere.transactionDate.lte = new Date(endDate)
    }

    // Calculate inflow adjustment if enabled
    let inflowTotal = 0
    if (includeInflow) {
      const inflowWhere = {
        ...baseTransactionWhere,
        type: { isOutflow: false },
      }

      const inflowResult = await db.transaction.aggregate({
        where: inflowWhere,
        _sum: { amount: true },
      })

      inflowTotal = Math.abs(inflowResult._sum.amount?.toNumber() || 0)
    }

    // Calculate total budget (base budget + inflow if enabled)
    const totalBudget = basePeriodBudget + inflowTotal

    // Get outflow spending
    const outflowWhere = {
      ...baseTransactionWhere,
      type: { isOutflow: true },
    }

    const spendingResult = await db.transaction.aggregate({
      where: outflowWhere,
      _sum: { amount: true },
    })

    const totalSpending = Math.abs(spendingResult._sum.amount?.toNumber() || 0)

    // Calculate spending by category
    const categorySpending = await db.transaction.groupBy({
      by: ['categoryId'],
      where: outflowWhere,
      _sum: { amount: true },
    })

    // Get category names
    const categoryIds = categorySpending
      .map((item) => item.categoryId)
      .filter((id): id is string => id !== null)

    const categories = await db.householdCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    })

    const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]))

    const categoryBreakdown = categorySpending.map((item) => ({
      categoryId: item.categoryId,
      categoryName: categoryMap.get(item.categoryId || '') || 'Unknown',
      amount: Math.abs(item._sum.amount?.toNumber() || 0),
    }))

    // Sort by spending amount descending
    categoryBreakdown.sort((a, b) => b.amount - a.amount)

    // Calculate percentages and status
    const spendingPercentage = totalBudget > 0 ? (totalSpending / totalBudget) * 100 : 0
    const remainingBudget = totalBudget - totalSpending
    const isOverBudget = totalSpending > totalBudget
    const overspendAmount = isOverBudget ? totalSpending - totalBudget : 0

    // Get top 10 transactions for detail view
    const topTransactions = await db.transaction.findMany({
      where: outflowWhere,
      orderBy: { amount: 'asc' }, // Most negative (highest spending) first
      take: 10,
      include: {
        category: { select: { name: true } },
        type: { select: { name: true } },
      },
    })

    const formattedTransactions = topTransactions.map((t) => ({
      id: t.id,
      date: t.transactionDate.toISOString().split('T')[0],
      description: t.description,
      category: t.category?.name || 'Unknown',
      type: t.type?.name || 'Unknown',
      amount: t.amount.toNumber(),
    }))

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        annualBudget: userAnnualBudget,
      },
      basePeriodBudget,
      inflowTotal,
      totalBudget,
      totalSpending,
      remainingBudget,
      spendingPercentage: Math.round(spendingPercentage * 100) / 100,
      isOverBudget,
      overspendAmount,
      categoryBreakdown,
      topTransactions: formattedTransactions,
      includeInflow,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch user budget data',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch user budget data' }, { status: 500 })
  }
}
