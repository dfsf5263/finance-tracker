import { getTransactionAnalytics, hasTransactionsInPeriod } from '@/lib/analytics'
import {
  getHouseholdBudgetPerformance,
  getCategoryBudgetPerformance,
  getUserBudgetPerformance,
} from '@/lib/budget-analytics'
import { getHouseholdUsers } from '@/lib/user-analytics'
import logger from '@/lib/logger'
import { monthStartISO, monthEndISO, monthName as getMonthLabel } from '@/lib/date-utils'

interface MonthlySpendingData {
  currentTotal: number
  previousTotal: number
  percentageChange: number
  trend: 'up' | 'down'
}

interface BudgetPerformanceData {
  budgetUsed: number
  totalBudget: number
  percentageUsed: number
  status: 'on-track' | 'warning' | 'over-budget'
}

interface CategoryData {
  name: string
  amount: number
  percentage: number
}

interface CashFlowData {
  income: number
  expenses: number
  netFlow: number
  isPositive: boolean
}

interface BudgetAlert {
  type: 'household' | 'category' | 'user'
  severity: 'critical' | 'warning' | 'info'
  name?: string
  message?: string
  budgetUsed: number
  totalBudget: number
  percentageUsed: number
  overspendAmount?: number
}

export interface HouseholdSummaryData {
  householdId: string
  householdName: string
  period: {
    start: string
    end: string
    type: 'current' | 'review'
    monthName: string
    year: number
  }
  spending: MonthlySpendingData
  budgetPerformance: BudgetPerformanceData | null
  topCategories: CategoryData[]
  cashFlow: CashFlowData
  budgetAlerts: BudgetAlert[]
}

export async function generateHouseholdSummary(
  householdId: string,
  householdName: string
): Promise<HouseholdSummaryData | null> {
  const now = new Date()
  const currentDay = now.getDate()
  const isMonthlyReview = currentDay <= 7

  // Determine reporting period
  let targetMonth: number
  let targetYear: number
  let periodType: 'current' | 'review'

  if (isMonthlyReview) {
    // Days 1-7: Report on previous month
    const prevMonth = now.getMonth() // 0-indexed, so this is actually last month in 1-indexed
    targetMonth = prevMonth === 0 ? 12 : prevMonth
    targetYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear()
    periodType = 'review'
  } else {
    // Days 8-31: Report on current month
    targetMonth = now.getMonth() + 1
    targetYear = now.getFullYear()
    periodType = 'current'
  }

  const periodMonthName = getMonthLabel(targetMonth)

  // Format dates for API calls
  const startDateStr = monthStartISO(targetYear, targetMonth)
  const endDateStr = monthEndISO(targetYear, targetMonth)

  // Calculate previous period dates for comparison
  const prevTargetMonth = targetMonth === 1 ? 12 : targetMonth - 1
  const prevTargetYear = targetMonth === 1 ? targetYear - 1 : targetYear
  const prevStartDateStr = monthStartISO(prevTargetYear, prevTargetMonth)
  const prevEndDateStr = monthEndISO(prevTargetYear, prevTargetMonth)

  // Check if household has any transactions in the reporting period
  const hasTransactions = await hasTransactionsInPeriod(householdId, startDateStr, endDateStr)
  if (!hasTransactions) {
    logger.info(
      { householdId, householdName, startDate: startDateStr, endDate: endDateStr },
      'Skipping household - no transactions for period'
    )
    return null
  }

  try {
    // Get current period spending
    const currentSpendingData = await getTransactionAnalytics({
      householdId,
      startDate: startDateStr,
      endDate: endDateStr,
      groupBy: 'category',
    })

    // Get previous period spending
    const prevSpendingData = await getTransactionAnalytics({
      householdId,
      startDate: prevStartDateStr,
      endDate: prevEndDateStr,
      groupBy: 'category',
    })

    // Calculate spending totals and cash flow
    let currentTotal = 0
    let income = 0
    let expenses = 0
    const categoryMap = new Map<string, number>()

    currentSpendingData.forEach((item: { value: number; name: string }) => {
      if (item.value > 0) {
        income += item.value
      } else {
        expenses += Math.abs(item.value)
        currentTotal += Math.abs(item.value)
        categoryMap.set(item.name, Math.abs(item.value))
      }
    })

    const prevTotal = prevSpendingData.reduce(
      (sum: number, item: { value: number }) => sum + (item.value < 0 ? Math.abs(item.value) : 0),
      0
    )

    const percentageChange = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0

    // Get top categories
    const sortedCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: currentTotal > 0 ? (amount / currentTotal) * 100 : 0,
      }))

    // Get household budget performance
    const budgetData = await getHouseholdBudgetPerformance(
      householdId,
      startDateStr,
      endDateStr,
      'month'
    )

    let budgetPerformance: BudgetPerformanceData | null = null
    if (!budgetData.noBudget && budgetData.periodBudget && budgetData.totalSpending !== undefined) {
      const percentageUsed = budgetData.budgetUsedPercentage || 0
      let status: 'on-track' | 'warning' | 'over-budget' = 'on-track'
      if (percentageUsed > 100) status = 'over-budget'
      else if (percentageUsed >= 80) status = 'warning'

      budgetPerformance = {
        budgetUsed: budgetData.totalSpending,
        totalBudget: budgetData.periodBudget,
        percentageUsed,
        status,
      }
    }

    // Fetch budget alerts
    const budgetAlerts: BudgetAlert[] = []

    // Household budget alerts
    if (budgetPerformance) {
      if (budgetPerformance.percentageUsed > 100) {
        budgetAlerts.push({
          type: 'household',
          severity: 'critical',
          message: 'Household budget exceeded',
          budgetUsed: budgetPerformance.budgetUsed,
          totalBudget: budgetPerformance.totalBudget,
          percentageUsed: budgetPerformance.percentageUsed,
          overspendAmount: budgetPerformance.budgetUsed - budgetPerformance.totalBudget,
        })
      } else if (budgetPerformance.percentageUsed >= 80) {
        budgetAlerts.push({
          type: 'household',
          severity: 'warning',
          message: 'Household budget nearly exhausted',
          budgetUsed: budgetPerformance.budgetUsed,
          totalBudget: budgetPerformance.totalBudget,
          percentageUsed: budgetPerformance.percentageUsed,
        })
      } else if (budgetPerformance.percentageUsed >= 50) {
        budgetAlerts.push({
          type: 'household',
          severity: 'info',
          message: 'Household has exceeded 50% of budget',
          budgetUsed: budgetPerformance.budgetUsed,
          totalBudget: budgetPerformance.totalBudget,
          percentageUsed: budgetPerformance.percentageUsed,
        })
      }
    }

    // Category budget alerts
    const categoryBudgetData = await getCategoryBudgetPerformance(
      householdId,
      startDateStr,
      endDateStr,
      'month'
    )

    categoryBudgetData.forEach((category) => {
      if (category.periodBudget && category.periodBudget > 0) {
        const percentage = category.budgetUsedPercentage
        if (category.overspend) {
          budgetAlerts.push({
            type: 'category',
            severity: 'critical',
            name: category.categoryName,
            budgetUsed: category.actualSpending,
            totalBudget: category.periodBudget,
            percentageUsed: percentage,
            overspendAmount: category.overspendAmount,
          })
        } else if (percentage >= 80) {
          budgetAlerts.push({
            type: 'category',
            severity: 'warning',
            name: category.categoryName,
            budgetUsed: category.actualSpending,
            totalBudget: category.periodBudget,
            percentageUsed: percentage,
          })
        } else if (percentage >= 50) {
          budgetAlerts.push({
            type: 'category',
            severity: 'info',
            name: category.categoryName,
            budgetUsed: category.actualSpending,
            totalBudget: category.periodBudget,
            percentageUsed: percentage,
          })
        }
      }
    })

    // User budget alerts
    const users = await getHouseholdUsers(householdId)
    for (const user of users) {
      if (user.annualBudget) {
        const userData = await getUserBudgetPerformance(
          householdId,
          user.id,
          startDateStr,
          endDateStr,
          'month'
        )

        if (!userData.noBudget && userData.spendingPercentage !== undefined) {
          const percentage = userData.spendingPercentage
          if (userData.isOverBudget) {
            budgetAlerts.push({
              type: 'user',
              severity: 'critical',
              name: user.name,
              budgetUsed: userData.totalSpending || 0,
              totalBudget: userData.totalBudget || 0,
              percentageUsed: percentage,
              overspendAmount: userData.overspendAmount,
            })
          } else if (percentage >= 80) {
            budgetAlerts.push({
              type: 'user',
              severity: 'warning',
              name: user.name,
              budgetUsed: userData.totalSpending || 0,
              totalBudget: userData.totalBudget || 0,
              percentageUsed: percentage,
            })
          } else if (percentage >= 50) {
            budgetAlerts.push({
              type: 'user',
              severity: 'info',
              name: user.name,
              budgetUsed: userData.totalSpending || 0,
              totalBudget: userData.totalBudget || 0,
              percentageUsed: percentage,
            })
          }
        }
      }
    }

    // Sort alerts by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    budgetAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return {
      householdId,
      householdName,
      period: {
        start: startDateStr,
        end: endDateStr,
        type: periodType,
        monthName: periodMonthName,
        year: targetYear,
      },
      spending: {
        currentTotal,
        previousTotal: prevTotal,
        percentageChange: Math.abs(percentageChange),
        trend: percentageChange >= 0 ? 'up' : 'down',
      },
      budgetPerformance,
      topCategories: sortedCategories,
      cashFlow: {
        income,
        expenses,
        netFlow: income - expenses,
        isPositive: income - expenses >= 0,
      },
      budgetAlerts,
    }
  } catch (error) {
    logger.error({ err: error, householdId }, 'Error generating summary for household')
    throw error
  }
}
