'use client'

import { useState, useEffect } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'
import { useActiveMonth } from '@/hooks/use-active-month'

interface MonthlyData {
  month: string
  monthNumber: number
  year: number
  spending: number
  budget: number | null
  isCurrentMonth: boolean
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    dataKey: string
    payload: MonthlyData
  }>
  label?: string
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-primary">Spending: {formatCurrency(data.spending)}</p>
        {data.budget && (
          <p className="text-sm text-muted-foreground">Budget: {formatCurrency(data.budget)}</p>
        )}
        {data.budget && (
          <p className="text-sm text-muted-foreground">
            {data.spending > data.budget ? 'Over' : 'Under'} by:{' '}
            {formatCurrency(Math.abs(data.spending - data.budget))}
          </p>
        )}
      </div>
    )
  }
  return null
}

export function MonthlySpendingChart() {
  const { selectedHousehold } = useHousehold()
  const { activeMonth, activeYear } = useActiveMonth(selectedHousehold?.id || null)
  const [data, setData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    const fetchMonthlyData = async () => {
      setLoading(true)
      setError(null)

      try {
        const currentYear = activeYear
        const currentMonth = activeMonth
        const monthlyData: MonthlyData[] = []

        // Generate last 6 months of data
        for (let i = 5; i >= 0; i--) {
          let targetMonth = currentMonth - i
          let targetYear = currentYear

          // Handle year boundary
          if (targetMonth <= 0) {
            targetMonth += 12
            targetYear -= 1
          }

          const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0]
          const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0]

          // Fetch spending data
          const spendingResponse = await fetch(
            `/api/transactions/analytics?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&groupBy=category`
          )

          let spending = 0
          if (spendingResponse.ok) {
            const spendingData = await spendingResponse.json()
            spending = spendingData
              .filter((item: { value: number }) => item.value < 0)
              .reduce((sum: number, item: { value: number }) => sum + Math.abs(item.value), 0)
          }

          // Fetch budget data for this month
          const budgetResponse = await fetch(
            `/api/budgets/household-budget?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&timePeriodType=month&budgetType=household`
          )

          let budget = null
          if (budgetResponse.ok) {
            const budgetData = await budgetResponse.json()
            if (!budgetData.noBudget && budgetData.periodBudget) {
              budget = budgetData.periodBudget
            }
          }

          monthlyData.push({
            month: getMonthName(targetMonth).slice(0, 3), // Short month name
            monthNumber: targetMonth,
            year: targetYear,
            spending,
            budget,
            isCurrentMonth: targetMonth === currentMonth && targetYear === currentYear,
          })
        }

        setData(monthlyData)
      } catch (error) {
        console.error('Error fetching monthly spending data:', error)
        setError('Failed to load spending data')
      } finally {
        setLoading(false)
      }
    }

    fetchMonthlyData()
  }, [selectedHousehold?.id, activeMonth, activeYear])

  if (loading) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Monthly Spending Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-muted/50 rounded-lg flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Monthly Spending Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-muted/50 rounded-lg flex items-center justify-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Chart automatically scales based on data

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Monthly Spending Overview</CardTitle>
        <p className="text-sm text-muted-foreground">Past 6 months spending vs budget targets</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value).replace('$', '$')}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Spending bars */}
              <Bar dataKey="spending" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Spending" />

              {/* Budget line */}
              <Line
                type="monotone"
                dataKey="budget"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                connectNulls={false}
                name="Budget"
              />

              {/* Reference line for current month */}
              {data.findIndex((d) => d.isCurrentMonth) !== -1 && (
                <ReferenceLine
                  x={data.find((d) => d.isCurrentMonth)?.month}
                  stroke="#f59e0b"
                  strokeDasharray="2 2"
                  label={{ value: 'Current', position: 'top' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Avg Monthly</p>
            <p className="font-semibold">
              {formatCurrency(data.reduce((sum, d) => sum + d.spending, 0) / data.length)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="font-semibold">
              {formatCurrency(data.find((d) => d.isCurrentMonth)?.spending || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Highest Month</p>
            <p className="font-semibold">
              {formatCurrency(Math.max(...data.map((d) => d.spending)))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Over Budget</p>
            <p className="font-semibold">
              {data.filter((d) => d.budget && d.spending > d.budget).length} months
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
