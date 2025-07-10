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

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 })
    }

    // Build transaction filter
    const transactionWhere: Prisma.TransactionWhereInput = {
      householdId: householdId,
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
