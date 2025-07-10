'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter, TrendingUp, TrendingDown, Target } from 'lucide-react'
import {
  formatCurrency,
  getDateRange,
  getMonthName,
  getCurrentYear,
  getCurrentMonth,
  getCurrentQuarter,
} from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'

interface BudgetAuditData {
  categoryId: string
  categoryName: string
  annualBudget: number | null
  periodBudget: number | null
  actualSpending: number
  overspend: boolean
  overspendAmount: number
  budgetUsedPercentage: number
}

interface Category {
  id: string
  name: string
  annualBudget?: number | null
}

interface DateRanges {
  years: number[]
  currentYear: number
  currentMonth: number
}

interface TimePeriod {
  type: 'all' | 'year' | 'month' | 'quarter'
  year: number
  month: number
  quarter: number
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: BudgetAuditData & { budget: number; actual: number } }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-primary">
          Budget: {data.periodBudget ? formatCurrency(data.periodBudget) : 'Not set'}
        </p>
        <p className="text-sm text-muted-foreground">
          Actual: {formatCurrency(data.actualSpending)}
        </p>
        {data.periodBudget && (
          <p className="text-sm text-muted-foreground">
            {data.budgetUsedPercentage.toFixed(1)}% of budget used
          </p>
        )}
        {data.overspend && (
          <p className="text-sm text-destructive font-medium">
            Over budget by {formatCurrency(data.overspendAmount)}
          </p>
        )}
      </div>
    )
  }
  return null
}

export function BudgetAudit() {
  const { selectedHousehold } = useHousehold()
  const [data, setData] = useState<BudgetAuditData[]>([])
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>({
    type: 'month',
    year: getCurrentYear(),
    month: getCurrentMonth(),
    quarter: getCurrentQuarter(),
  })
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<Category[]>([])
  const [dateRanges, setDateRanges] = useState<DateRanges>({
    years: [],
    currentYear: getCurrentYear(),
    currentMonth: getCurrentMonth(),
  })

  // Fetch available date ranges
  useEffect(() => {
    const fetchDateRanges = async () => {
      if (!selectedHousehold) return
      try {
        const response = await fetch(
          `/api/transactions/date-ranges?householdId=${selectedHousehold.id}`
        )
        if (response.ok) {
          const ranges = await response.json()
          setDateRanges(ranges)
        }
      } catch (error) {
        console.error('Failed to fetch date ranges:', error)
      }
    }
    fetchDateRanges()
  }, [selectedHousehold])

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      if (!selectedHousehold) return
      try {
        const response = await fetch(`/api/categories?householdId=${selectedHousehold.id}`)
        if (response.ok) {
          const categoriesData = await response.json()
          // Filter to only include categories with budgets
          const categoriesWithBudgets = categoriesData.filter(
            (cat: Category) => cat.annualBudget !== null && cat.annualBudget !== undefined
          )
          setCategories(categoriesWithBudgets)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    fetchCategories()
  }, [selectedHousehold])

  // Helper function to convert timePeriod to start/end dates
  const getDateRangeFromPeriod = (period: TimePeriod): { startDate: string; endDate: string } => {
    return getDateRange(period.type, period.year, period.month, period.quarter)
  }

  const fetchBudgetAudit = async () => {
    if (!selectedHousehold) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        householdId: selectedHousehold.id,
        timePeriodType: timePeriod.type,
      })

      const dateRange = getDateRangeFromPeriod(timePeriod)
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      if (categoryFilter && categoryFilter !== 'all') params.append('categoryId', categoryFilter)

      const response = await fetch(`/api/budgets/audit?${params}`)
      if (response.ok) {
        const auditData = await response.json()
        setData(auditData)
      } else {
        console.error('Failed to fetch budget audit data')
      }
    } catch (error) {
      console.error('Error fetching budget audit data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBudgetAudit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHousehold, timePeriod, categoryFilter])

  // Prepare chart data
  const chartData = data.map((item) => ({
    name: item.categoryName,
    budget: item.periodBudget || 0,
    actual: item.actualSpending,
    ...item,
  }))

  // Get summary statistics
  const totalBudget = data.reduce((sum, item) => sum + (item.periodBudget || 0), 0)
  const totalSpending = data.reduce((sum, item) => sum + item.actualSpending, 0)
  const categoriesOverBudget = data.filter((item) => item.overspend).length
  const totalOverspend = data.reduce((sum, item) => sum + item.overspendAmount, 0)

  const getBarColor = (item: BudgetAuditData & { budget: number; actual: number }) => {
    if (!item.periodBudget) return '#94a3b8' // Slate-400
    if (item.overspend) return '#ef4444' // Red-500
    if (item.budgetUsedPercentage >= 80) return '#f59e0b' // Amber-500
    return '#3b82f6' // Blue-500
  }

  const getPeriodLabel = (period: TimePeriod) => {
    switch (period.type) {
      case 'month':
        return `${getMonthName(period.month)} ${period.year}`
      case 'quarter':
        return `Q${period.quarter} ${period.year}`
      case 'year':
        return period.year.toString()
      case 'all':
        return 'All Time'
      default:
        return 'Current Period'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Budget Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading budget audit...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Budget Audit - {getPeriodLabel(timePeriod)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 py-4">
            {/* Time Period Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Time Period
              </Label>
              <div className="flex space-x-2">
                <Select
                  value={timePeriod.type}
                  onValueChange={(value: 'all' | 'year' | 'month' | 'quarter') =>
                    setTimePeriod({ ...timePeriod, type: value })
                  }
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>

                {timePeriod.type !== 'all' && (
                  <Select
                    value={timePeriod.year.toString()}
                    onValueChange={(value) =>
                      setTimePeriod({ ...timePeriod, year: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateRanges.years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {timePeriod.type === 'month' && (
                  <Select
                    value={timePeriod.month.toString()}
                    onValueChange={(value) =>
                      setTimePeriod({ ...timePeriod, month: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {getMonthName(month)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {timePeriod.type === 'quarter' && (
                  <Select
                    value={timePeriod.quarter.toString()}
                    onValueChange={(value) =>
                      setTimePeriod({ ...timePeriod, quarter: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                <p className="text-lg font-bold">{formatCurrency(totalBudget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Spending</p>
                <p className="text-lg font-bold">{formatCurrency(totalSpending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categories Over Budget</p>
                <p className="text-lg font-bold">{categoriesOverBudget}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Overspend</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totalOverspend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual Chart */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Budget vs Actual Spending</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No data available for the selected period</p>
            </div>
          ) : (
            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={12}
                    tick={{ fill: 'var(--foreground)' }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fill: 'var(--foreground)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="budget" fill="#60a5fa" opacity={0.6} name="Budget" />
                  <Bar dataKey="actual" name="Actual">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Detailed Budget Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Budget</th>
                  <th className="text-right p-2">Actual</th>
                  <th className="text-right p-2">% Used</th>
                  <th className="text-right p-2">Variance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.categoryId} className="border-b">
                    <td className="p-2 font-medium">{item.categoryName}</td>
                    <td className="p-2 text-right">
                      {item.periodBudget ? formatCurrency(item.periodBudget) : 'Not set'}
                    </td>
                    <td className="p-2 text-right">{formatCurrency(item.actualSpending)}</td>
                    <td className="p-2 text-right">
                      {item.periodBudget ? `${item.budgetUsedPercentage.toFixed(1)}%` : '-'}
                    </td>
                    <td
                      className={`p-2 text-right font-medium ${
                        item.overspend ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {item.periodBudget
                        ? formatCurrency((item.actualSpending - item.periodBudget) * -1)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
