import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const householdId = searchParams.get('householdId')
    const categoryId = searchParams.get('categoryId')
    const timePeriodType = searchParams.get('timePeriodType') || 'month' // month, quarter, year, all
    const auditType = searchParams.get('auditType') || 'category' // category or household

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 })
    }

    // Handle household audit type
    if (auditType === 'household') {
      // Fetch household with budget
      const household = await db.household.findUnique({
        where: { id: householdId },
        select: {
          annualBudget: true,
        },
      })

      if (!household || !household.annualBudget) {
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
          case 'all':
            return 1
          default:
            return 12
        }
      }

      const budgetDivisor = getPeriodBudgetDivisor(timePeriodType)
      const householdBudget = parseFloat(household.annualBudget.toString())
      const periodBudget = householdBudget / budgetDivisor

      // Build transaction filter - only outflow transactions
      const transactionWhere: Prisma.TransactionWhereInput = {
        householdId: householdId,
        type: {
          isOutflow: true,
        },
      }

      if (startDate || endDate) {
        transactionWhere.transactionDate = {}
        if (startDate) transactionWhere.transactionDate.gte = new Date(startDate)
        if (endDate) transactionWhere.transactionDate.lte = new Date(endDate)
      }

      // Get total spending
      const totalSpendingResult = await db.transaction.aggregate({
        where: transactionWhere,
        _sum: {
          amount: true,
        },
      })

      const totalSpending = Math.abs(totalSpendingResult._sum.amount?.toNumber() || 0)

      // Get spending over time
      const transactions = await db.transaction.findMany({
        where: transactionWhere,
        orderBy: {
          transactionDate: 'asc',
        },
        select: {
          transactionDate: true,
          amount: true,
        },
      })

      // Group by date and calculate cumulative
      const dailySpending = new Map<string, number>()
      transactions.forEach((transaction) => {
        const dateKey = transaction.transactionDate.toISOString().split('T')[0]
        const current = dailySpending.get(dateKey) || 0
        dailySpending.set(dateKey, current + Math.abs(transaction.amount.toNumber()))
      })

      // Create cumulative spending array with budget progress
      let cumulative = 0
      const sortedDates = Array.from(dailySpending.entries()).sort(([a], [b]) => a.localeCompare(b))

      // Calculate daily budget rate
      const totalDays = sortedDates.length || 1
      const dailyBudgetRate = periodBudget / totalDays

      const spendingOverTime = sortedDates.map(([date, amount], index) => {
        cumulative += amount
        const budgetProgress = dailyBudgetRate * (index + 1) // Expected cumulative budget at this point

        return {
          date,
          dailyAmount: amount,
          cumulativeAmount: cumulative,
          budgetProgress,
        }
      })

      // Calculate daily average
      const dayCount = spendingOverTime.length || 1
      const dailyAverage = totalSpending / dayCount

      // Get top 10 transactions
      const topTransactions = await db.transaction.findMany({
        where: transactionWhere,
        orderBy: {
          amount: 'asc', // Most negative (highest spending) first
        },
        take: 10,
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
      })

      const formattedTopTransactions = topTransactions.map((t) => ({
        id: t.id,
        date: t.transactionDate.toISOString().split('T')[0],
        description: t.description,
        category: t.category.name,
        amount: t.amount.toNumber(),
      }))

      return NextResponse.json({
        householdBudget,
        periodBudget,
        totalSpending,
        dailyAverage,
        spendingOverTime,
        topTransactions: formattedTopTransactions,
      })
    }

    // Build transaction filter - only outflow transactions
    const transactionWhere: Prisma.TransactionWhereInput = {
      householdId: householdId,
      type: {
        isOutflow: true,
      },
    }

    if (startDate || endDate) {
      transactionWhere.transactionDate = {}
      if (startDate) transactionWhere.transactionDate.gte = new Date(startDate)
      if (endDate) transactionWhere.transactionDate.lte = new Date(endDate)
    }

    if (categoryId && categoryId !== 'all') {
      transactionWhere.categoryId = categoryId
    }

    // Get all categories with their budgets
    const categoryWhere: Prisma.HouseholdCategoryWhereInput = {
      householdId: householdId,
    }

    if (categoryId && categoryId !== 'all') {
      categoryWhere.id = categoryId
    }

    const categories = await db.householdCategory.findMany({
      where: {
        ...categoryWhere,
        annualBudget: { not: null }, // Only include categories with budgets
      },
      select: {
        id: true,
        name: true,
        annualBudget: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Get transaction totals by category
    const transactionTotals = await db.transaction.groupBy({
      by: ['categoryId'],
      where: transactionWhere,
      _sum: {
        amount: true,
      },
    })

    // Create a map of category spending
    const spendingMap = new Map<string, number>()
    transactionTotals.forEach((total) => {
      if (total.categoryId && total._sum.amount) {
        spendingMap.set(total.categoryId, parseFloat(total._sum.amount.toString()))
      }
    })

    // Calculate period budget divisor
    const getPeriodBudgetDivisor = (timePeriodType: string): number => {
      switch (timePeriodType) {
        case 'month':
          return 12
        case 'quarter':
          return 4
        case 'year':
        case 'all':
          return 1
        default:
          return 12
      }
    }

    const budgetDivisor = getPeriodBudgetDivisor(timePeriodType)

    // Build response data
    const budgetAuditData = categories.map((category) => {
      const actualSpending = Math.abs(spendingMap.get(category.id) || 0) // Use absolute value for comparison
      const annualBudget = category.annualBudget
        ? parseFloat(category.annualBudget.toString())
        : null
      const periodBudget = annualBudget ? annualBudget / budgetDivisor : null

      const overspend = periodBudget ? actualSpending > periodBudget : false
      const overspendAmount = overspend && periodBudget ? actualSpending - periodBudget : 0
      const budgetUsedPercentage =
        periodBudget && periodBudget > 0 ? (actualSpending / periodBudget) * 100 : 0

      return {
        categoryId: category.id,
        categoryName: category.name,
        annualBudget,
        periodBudget,
        actualSpending,
        overspend,
        overspendAmount,
        budgetUsedPercentage: Math.round(budgetUsedPercentage * 100) / 100, // Round to 2 decimal places
      }
    })

    // Check if no categories with budgets exist
    if (budgetAuditData.length === 0) {
      return NextResponse.json({ noBudget: true })
    }

    // Sort by overspend first, then by budget usage percentage
    budgetAuditData.sort((a, b) => {
      if (a.overspend && !b.overspend) return -1
      if (!a.overspend && b.overspend) return 1
      return b.budgetUsedPercentage - a.budgetUsedPercentage
    })

    return NextResponse.json(budgetAuditData)
  } catch (error) {
    console.error('Error fetching budget audit data:', error)
    return NextResponse.json({ error: 'Failed to fetch budget audit data' }, { status: 500 })
  }
}
