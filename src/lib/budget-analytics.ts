import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export interface HouseholdBudgetPerformance {
  noBudget: boolean
  periodBudget?: number
  totalSpending?: number
  budgetUsedPercentage?: number
  isOverBudget?: boolean
  overspendAmount?: number
}

export interface CategoryBudgetPerformance {
  categoryName: string
  periodBudget: number
  actualSpending: number
  budgetUsedPercentage: number
  overspend: boolean
  overspendAmount?: number
}

export interface UserBudgetPerformance {
  noBudget: boolean
  totalBudget?: number
  totalSpending?: number
  spendingPercentage?: number
  isOverBudget?: boolean
  overspendAmount?: number
}

export async function getHouseholdBudgetPerformance(
  householdId: string,
  startDate: string,
  endDate: string,
  timePeriodType: 'month' | 'quarter' | 'year' = 'month'
): Promise<HouseholdBudgetPerformance> {
  // Fetch household with budget
  const household = await db.household.findUnique({
    where: { id: householdId },
    select: {
      annualBudget: true,
    },
  })

  if (!household || !household.annualBudget) {
    return { noBudget: true }
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
  const budgetUsedPercentage = (totalSpending / periodBudget) * 100
  const isOverBudget = budgetUsedPercentage > 100
  const overspendAmount = isOverBudget ? totalSpending - periodBudget : undefined

  return {
    noBudget: false,
    periodBudget,
    totalSpending,
    budgetUsedPercentage,
    isOverBudget,
    overspendAmount,
  }
}

export async function getCategoryBudgetPerformance(
  householdId: string,
  startDate: string,
  endDate: string,
  timePeriodType: 'month' | 'quarter' | 'year' = 'month'
): Promise<CategoryBudgetPerformance[]> {
  // Get categories with budgets
  const categoriesWithBudgets = await db.householdCategory.findMany({
    where: {
      householdId: householdId,
      annualBudget: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      annualBudget: true,
    },
  })

  if (categoriesWithBudgets.length === 0) {
    return []
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

  const results: CategoryBudgetPerformance[] = []

  for (const category of categoriesWithBudgets) {
    const periodBudget = parseFloat(category.annualBudget!.toString()) / budgetDivisor

    // Get spending for this category
    const categorySpendingResult = await db.transaction.aggregate({
      where: {
        householdId: householdId,
        categoryId: category.id,
        type: {
          isOutflow: true,
        },
        transactionDate: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
      },
      _sum: {
        amount: true,
      },
    })

    const actualSpending = Math.abs(categorySpendingResult._sum.amount?.toNumber() || 0)
    const budgetUsedPercentage = (actualSpending / periodBudget) * 100
    const overspend = budgetUsedPercentage > 100
    const overspendAmount = overspend ? actualSpending - periodBudget : undefined

    results.push({
      categoryName: category.name,
      periodBudget,
      actualSpending,
      budgetUsedPercentage,
      overspend,
      overspendAmount,
    })
  }

  return results
}

export async function getUserBudgetPerformance(
  householdId: string,
  userId: string,
  startDate: string,
  endDate: string,
  timePeriodType: 'month' | 'quarter' | 'year' = 'month'
): Promise<UserBudgetPerformance> {
  // Get user with budget
  const user = await db.householdUser.findUnique({
    where: { id: userId },
    select: {
      annualBudget: true,
    },
  })

  if (!user || !user.annualBudget) {
    return { noBudget: true }
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
  const totalBudget = parseFloat(user.annualBudget.toString()) / budgetDivisor

  // Get user spending
  const userSpendingResult = await db.transaction.aggregate({
    where: {
      householdId: householdId,
      userId: userId,
      type: {
        isOutflow: true,
      },
      transactionDate: {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      },
    },
    _sum: {
      amount: true,
    },
  })

  const totalSpending = Math.abs(userSpendingResult._sum.amount?.toNumber() || 0)
  const spendingPercentage = (totalSpending / totalBudget) * 100
  const isOverBudget = spendingPercentage > 100
  const overspendAmount = isOverBudget ? totalSpending - totalBudget : undefined

  return {
    noBudget: false,
    totalBudget,
    totalSpending,
    spendingPercentage,
    isOverBudget,
    overspendAmount,
  }
}
