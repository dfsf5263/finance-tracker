'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'
import { useActiveMonth } from '@/hooks/use-active-month'

interface CategoryData {
  name: string
  value: number
  percentage: number
  color: string
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    payload: CategoryData
  }>
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-primary">Amount: {formatCurrency(data.value)}</p>
        <p className="text-sm text-muted-foreground">
          {data.percentage.toFixed(1)}% of total spending
        </p>
      </div>
    )
  }
  return null
}

const CustomLegend = ({
  payload,
}: {
  payload?: Array<{ value: string; color: string; payload: CategoryData }>
}) => {
  if (!payload) return null

  return (
    <div className="grid grid-cols-1 gap-2 text-sm">
      {payload.slice(0, 6).map((entry, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="truncate max-w-[120px]">{entry.value}</span>
          </div>
          <span className="font-medium">{formatCurrency(entry.payload.value)}</span>
        </div>
      ))}
      {payload.length > 6 && (
        <div className="text-muted-foreground text-xs pt-1">
          +{payload.length - 6} more categories
        </div>
      )}
    </div>
  )
}

export function CategoryBreakdownChart() {
  const { selectedHousehold } = useHousehold()
  const { activeMonth, activeYear } = useActiveMonth(selectedHousehold?.id || null)
  const [data, setData] = useState<CategoryData[]>([])
  const [totalSpending, setTotalSpending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Color palette for categories
  const colors = [
    '#ef4444', // Red
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#ec4899', // Pink
    '#6b7280', // Gray
    '#14b8a6', // Teal
    '#f43f5e', // Rose
  ]

  useEffect(() => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    const fetchCategoryData = async () => {
      setLoading(true)
      setError(null)

      try {
        const currentYear = activeYear
        const currentMonth = activeMonth
        const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

        const response = await fetch(
          `/api/transactions/analytics?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&groupBy=category`
        )

        if (response.ok) {
          const apiData = await response.json()

          // Filter out income (positive values) and get expenses only
          const expenseData = apiData
            .filter((item: { value: number }) => item.value < 0)
            .map((item: { name: string; value: number }) => ({
              name: item.name,
              value: Math.abs(item.value),
              rawValue: item.value,
            }))
            .sort((a: { value: number }, b: { value: number }) => b.value - a.value)

          const total = expenseData.reduce(
            (sum: number, item: { value: number }) => sum + item.value,
            0
          )
          setTotalSpending(total)

          if (expenseData.length === 0) {
            setData([])
          } else {
            // Prepare data for chart with colors and percentages
            const chartData = expenseData.map(
              (item: { name: string; value: number }, index: number) => ({
                name: item.name,
                value: item.value,
                percentage: (item.value / total) * 100,
                color: colors[index % colors.length],
              })
            )

            // Group smaller categories into "Others" if there are more than 8 categories
            if (chartData.length > 8) {
              const mainCategories = chartData.slice(0, 7)
              const otherCategories = chartData.slice(7)
              const otherTotal = otherCategories.reduce(
                (sum: number, item: { value: number }) => sum + item.value,
                0
              )

              if (otherTotal > 0) {
                mainCategories.push({
                  name: 'Others',
                  value: otherTotal,
                  percentage: (otherTotal / total) * 100,
                  color: colors[7],
                })
              }

              setData(mainCategories)
            } else {
              setData(chartData)
            }
          }
        } else {
          throw new Error('Failed to fetch category data')
        }
      } catch (error) {
        console.error('Error fetching category breakdown:', error)
        setError('Failed to load category breakdown')
      } finally {
        setLoading(false)
      }
    }

    fetchCategoryData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHousehold?.id, activeMonth, activeYear])

  if (loading) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
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
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-muted/50 rounded-lg flex items-center justify-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">Current month spending by category</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-muted/50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">No spending data</p>
              <p className="text-xs text-muted-foreground">No expenses recorded this month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Category Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">Current month spending by category</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart */}
          <div className="relative h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={80}
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Spending</p>
                <p className="text-md font-bold">{formatCurrency(totalSpending)}</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col justify-center">
            <h4 className="font-medium mb-3">Categories</h4>
            <CustomLegend
              payload={data.map((item) => ({
                value: item.name,
                color: item.color,
                payload: item,
              }))}
            />

            {/* Summary stats */}
            <div className="mt-6 pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Top Category:</span>
                <span className="font-medium">{data[0]?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Categories:</span>
                <span className="font-medium">{data.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg per Category:</span>
                <span className="font-medium">{formatCurrency(totalSpending / data.length)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
