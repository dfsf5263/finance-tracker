'use client'

import { useState, useEffect } from 'react'
import { TrendingDown, TrendingUp, Tag, AlertCircle, AlertTriangle, Check } from 'lucide-react'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'
import { useActiveMonth } from '@/hooks/use-active-month'

interface MonthlySpendingData {
  currentMonth: number
  lastMonth: number
  percentageChange: number
  trend: 'up' | 'down'
}

interface BudgetPerformanceData {
  budgetUsed: number
  totalBudget: number
  percentageUsed: number
  status: 'on-track' | 'warning' | 'over-budget'
}

interface TopCategoryData {
  categoryName: string
  amount: number
  percentageOfTotal: number
}

interface CashFlowData {
  income: number
  expenses: number
  netFlow: number
  isPositive: boolean
}

const getBudgetStatus = (budgetPerformance: BudgetPerformanceData) => {
  const percentage = budgetPerformance.percentageUsed

  if (percentage >= 100 || budgetPerformance.status === 'over-budget') {
    return {
      icon: AlertCircle,
      textColor: 'text-red-600',
      iconColor: 'text-red-500',
      message: 'Exceeded',
    }
  } else if (percentage >= 80 || budgetPerformance.status === 'warning') {
    return {
      icon: AlertTriangle,
      textColor: 'text-amber-600',
      iconColor: 'text-amber-500',
      message: 'At Threshold',
    }
  } else {
    return {
      icon: Check,
      textColor: 'text-green-600',
      iconColor: 'text-green-500',
      message: 'On Track',
    }
  }
}

export function DashboardSummaryCards() {
  const { selectedHousehold } = useHousehold()
  const { activeMonth, activeYear } = useActiveMonth(selectedHousehold?.id || null)
  const [monthlySpending, setMonthlySpending] = useState<MonthlySpendingData | null>(null)
  const [budgetPerformance, setBudgetPerformance] = useState<BudgetPerformanceData | null>(null)
  const [topCategory, setTopCategory] = useState<TopCategoryData | null>(null)
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          fetchMonthlySpending(),
          fetchBudgetPerformance(),
          fetchTopCategory(),
          fetchCashFlow(),
        ])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHousehold?.id, activeMonth, activeYear])

  const fetchMonthlySpending = async () => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    try {
      const currentYear = activeYear
      const currentMonth = activeMonth
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear

      // Current month
      const currentStartDate = new Date(currentYear, currentMonth - 1, 1)
        .toISOString()
        .split('T')[0]
      const currentEndDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

      // Last month
      const lastStartDate = new Date(lastMonthYear, lastMonth - 1, 1).toISOString().split('T')[0]
      const lastEndDate = new Date(lastMonthYear, lastMonth, 0).toISOString().split('T')[0]

      const [currentResponse, lastResponse] = await Promise.all([
        fetch(
          `/api/transactions/analytics?householdId=${selectedHousehold.id}&startDate=${currentStartDate}&endDate=${currentEndDate}&groupBy=category`
        ),
        fetch(
          `/api/transactions/analytics?householdId=${selectedHousehold.id}&startDate=${lastStartDate}&endDate=${lastEndDate}&groupBy=category`
        ),
      ])

      if (currentResponse.ok && lastResponse.ok) {
        const currentData = await currentResponse.json()
        const lastData = await lastResponse.json()

        const currentTotal = currentData.reduce(
          (sum: number, item: { value: number }) => sum + Math.abs(item.value),
          0
        )
        const lastTotal = lastData.reduce(
          (sum: number, item: { value: number }) => sum + Math.abs(item.value),
          0
        )

        const percentageChange = lastTotal > 0 ? ((currentTotal - lastTotal) / lastTotal) * 100 : 0

        setMonthlySpending({
          currentMonth: currentTotal,
          lastMonth: lastTotal,
          percentageChange: Math.abs(percentageChange),
          trend: percentageChange >= 0 ? 'up' : 'down',
        })
      }
    } catch (error) {
      console.error('Error fetching monthly spending:', error)
    }
  }

  const fetchBudgetPerformance = async () => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    try {
      const currentYear = activeYear
      const currentMonth = activeMonth
      const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

      const response = await fetch(
        `/api/budgets/household-budget?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&timePeriodType=month&budgetType=household`
      )

      if (response.ok) {
        const data = await response.json()

        if (!data.noBudget && data.periodBudget) {
          const percentageUsed = (data.totalSpending / data.periodBudget) * 100
          let status: 'on-track' | 'warning' | 'over-budget' = 'on-track'

          if (percentageUsed > 100) {
            status = 'over-budget'
          } else if (percentageUsed > 80) {
            status = 'warning'
          }

          setBudgetPerformance({
            budgetUsed: data.totalSpending,
            totalBudget: data.periodBudget,
            percentageUsed,
            status,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching budget performance:', error)
    }
  }

  const fetchTopCategory = async () => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    try {
      const currentYear = activeYear
      const currentMonth = activeMonth
      const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

      const response = await fetch(
        `/api/transactions/analytics?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&groupBy=category`
      )

      if (response.ok) {
        const data = await response.json()

        if (data.length > 0) {
          // Filter out positive values (income) and sort by amount
          const expenseCategories = data
            .filter((item: { value: number }) => item.value < 0)
            .map((item: { value: number; name: string }) => ({
              ...item,
              value: Math.abs(item.value),
            }))
            .sort((a: { value: number }, b: { value: number }) => b.value - a.value)

          if (expenseCategories.length > 0) {
            const totalExpenses = expenseCategories.reduce(
              (sum: number, item: { value: number }) => sum + item.value,
              0
            )
            const topCat = expenseCategories[0]

            setTopCategory({
              categoryName: topCat.name,
              amount: topCat.value,
              percentageOfTotal: (topCat.value / totalExpenses) * 100,
            })
          }
        }
      }
    } catch (error) {
      console.error('Error fetching top category:', error)
    }
  }

  const fetchCashFlow = async () => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    try {
      const currentYear = activeYear
      const currentMonth = activeMonth
      const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

      const response = await fetch(
        `/api/transactions/analytics?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&groupBy=category`
      )

      if (response.ok) {
        const data = await response.json()

        let income = 0
        let expenses = 0

        data.forEach((item: { value: number }) => {
          if (item.value > 0) {
            income += item.value
          } else {
            expenses += Math.abs(item.value)
          }
        })

        const netFlow = income - expenses

        setCashFlow({
          income,
          expenses,
          netFlow,
          isPositive: netFlow >= 0,
        })
      }
    } catch (error) {
      console.error('Error fetching cash flow:', error)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card animate-pulse">
            <CardHeader>
              <CardDescription className="h-4 bg-muted rounded w-24"></CardDescription>
              <CardTitle className="h-8 bg-muted rounded w-32"></CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="h-4 bg-muted rounded w-40"></div>
              <div className="h-3 bg-muted rounded w-32"></div>
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Monthly Spending Summary */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Monthly Spending</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {monthlySpending ? formatCurrency(monthlySpending.currentMonth) : '--'}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center font-medium">
            {monthlySpending ? (
              <>
                {monthlySpending.trend === 'up' ? (
                  <TrendingUp className="size-4 mr-1 text-red-500" />
                ) : (
                  <TrendingDown className="size-4 mr-1 text-green-500" />
                )}
                {monthlySpending.percentageChange.toFixed(1)}
                {'% '}
                {monthlySpending.trend === 'up' ? 'Increase' : 'Decrease'}
              </>
            ) : (
              'Loading...'
            )}
          </div>
          <div className="text-muted-foreground">
            {monthlySpending
              ? `Previous: ${formatCurrency(monthlySpending.lastMonth)}`
              : 'Compared to last month'}
          </div>
        </CardFooter>
      </Card>

      {/* Budget Performance */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Monthly Budget Performance</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {budgetPerformance ? `${budgetPerformance.percentageUsed.toFixed(1)}%` : '--'}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center font-medium">
            {budgetPerformance ? (
              <>
                {(() => {
                  const status = getBudgetStatus(budgetPerformance)
                  const IconComponent = status.icon
                  return <IconComponent className={`size-4 mr-1 ${status.iconColor}`} />
                })()}
                <span className={getBudgetStatus(budgetPerformance).textColor}>
                  {getBudgetStatus(budgetPerformance).message}
                </span>
              </>
            ) : (
              'No budget set'
            )}
          </div>
          <div className="text-muted-foreground">
            {budgetPerformance
              ? `${formatCurrency(budgetPerformance.budgetUsed)} of ${formatCurrency(budgetPerformance.totalBudget)}`
              : 'Set household budget to track'}
          </div>
        </CardFooter>
      </Card>

      {/* Top Spending Category */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Monthly Top Category</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {topCategory ? formatCurrency(topCategory.amount) : '--'}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center font-medium">
            {topCategory ? (
              <>
                <Tag className="size-4 mr-1" />
                {topCategory.categoryName}
              </>
            ) : (
              'No spending data'
            )}
          </div>
          <div className="text-muted-foreground">
            {topCategory
              ? `${topCategory.percentageOfTotal.toFixed(1)}% of total spending`
              : 'No transactions this month'}
          </div>
        </CardFooter>
      </Card>

      {/* Monthly Income vs Expenses */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Monthly Net Cash Flow</CardDescription>
          <CardTitle
            className={`text-2xl font-semibold tabular-nums ${
              cashFlow?.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {cashFlow ? formatCurrency(cashFlow.netFlow) : '--'}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center font-medium">
            {cashFlow ? (
              <>
                {cashFlow.isPositive ? (
                  <TrendingUp className="size-4 mr-1" />
                ) : (
                  <TrendingDown className="size-4 mr-1" />
                )}
                {cashFlow.isPositive ? 'Positive' : 'Negative'}
              </>
            ) : (
              'Loading cash flow...'
            )}
          </div>
          <div className="text-muted-foreground">
            {cashFlow
              ? `Income: ${formatCurrency(cashFlow.income)} • Expenses: ${formatCurrency(cashFlow.expenses)}`
              : 'Income vs expenses this month'}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
