'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Filter,
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  Settings,
  ExternalLink,
} from 'lucide-react'
import {
  formatCurrency,
  getDateRange,
  getMonthName,
  getCurrentYear,
  getCurrentMonth,
  getCurrentQuarter,
} from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'

interface HouseholdBudgetData {
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

interface TimePeriod {
  type: 'year' | 'month' | 'quarter'
  year: number
  month: number
  quarter: number
}

interface HouseholdSummaryData {
  householdBudget: number
  periodBudget: number
  totalSpending: number
  dailyAverage: number
  spendingOverTime: Array<{
    date: string
    cumulativeAmount: number
    dailyAmount: number
    budgetProgress: number
  }>
  topTransactions: Array<{
    id: string
    date: string
    description: string
    category: string
    amount: number
  }>
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: HouseholdBudgetData & { budget: number; actual: number } }>
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

const LineChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    value: number
    payload: { date: string; cumulativeAmount: number; dailyAmount: number; budgetProgress: number }
  }>
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
        <p className="font-medium text-sm">{data.date}</p>
        <p className="text-sm text-muted-foreground">Daily: {formatCurrency(data.dailyAmount)}</p>
        <p className="text-sm text-primary">Total: {formatCurrency(data.cumulativeAmount)}</p>
        <p className="text-sm text-muted-foreground">
          Expected: {formatCurrency(data.budgetProgress)}
        </p>
      </div>
    )
  }
  return null
}

export function HouseholdBudget() {
  const { selectedHousehold } = useHousehold()
  const router = useRouter()
  const [data, setData] = useState<HouseholdBudgetData[]>([])
  const [householdData, setHouseholdData] = useState<HouseholdSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [budgetType, setBudgetType] = useState<'category' | 'household'>('category')
  const [householdNoBudget, setHouseholdNoBudget] = useState(false)
  const [categoryNoBudget, setCategoryNoBudget] = useState(false)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>({
    type: 'month',
    year: getCurrentYear(),
    month: getCurrentMonth(),
    quarter: getCurrentQuarter(),
  })
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<Category[]>([])

  // Generate static year list for last 5 years
  const yearOptions = Array.from({ length: 5 }, (_, i) => getCurrentYear() - i)

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

  const fetchHouseholdBudget = async () => {
    if (!selectedHousehold) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        householdId: selectedHousehold.id,
        timePeriodType: timePeriod.type,
        budgetType: budgetType,
      })

      const dateRange = getDateRangeFromPeriod(timePeriod)
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      if (categoryFilter && categoryFilter !== 'all' && budgetType === 'category') {
        params.append('categoryId', categoryFilter)
      }

      const response = await fetch(`/api/budgets/household-budget?${params}`)
      if (response.ok) {
        const householdBudgetData = await response.json()

        if (householdBudgetData.noBudget) {
          if (budgetType === 'category') {
            setCategoryNoBudget(true)
            setData([])
          } else {
            setHouseholdNoBudget(true)
            setHouseholdData(null)
          }
        } else {
          if (budgetType === 'category') {
            setCategoryNoBudget(false)
            setData(householdBudgetData)
          } else {
            setHouseholdNoBudget(false)
            setHouseholdData(householdBudgetData)
          }
        }
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
    fetchHouseholdBudget()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHousehold, timePeriod, categoryFilter, budgetType])

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

  const getBarColor = (item: HouseholdBudgetData & { budget: number; actual: number }) => {
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
            Household Budget
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
      {/* Information Accordion */}
      <Accordion type="single" collapsible>
        <AccordionItem value="purpose">
          <AccordionTrigger>Purpose</AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="pt-0 pb-4 px-4">
              <p className="text-sm text-muted-foreground">
                Track household spending against both category budgets and overall household budget
                to monitor financial health and identify areas of overspending or savings
                opportunities.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="setup">
          <AccordionTrigger>Required Setup</AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="pt-0 pb-4 px-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  To use this page effectively, you need to set up both category budgets and
                  household budget:
                </p>
                <ul className="list-disc list-outside ml-4 space-y-1">
                  <li>
                    <Link
                      href="/dashboard/definitions/categories"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      Manage Category Budgets <ExternalLink className="h-3 w-3" />
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/definitions/households"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      Set Up Household Budget <ExternalLink className="h-3 w-3" />
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="how-it-works">
          <AccordionTrigger>How It Works</AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="pt-0 pb-4 px-4">
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>
                  <strong>Category Summary:</strong> Compare actual spending vs. budgeted amounts
                  for each category
                </li>
                <li>
                  <strong>Household Summary:</strong> Track overall spending against total household
                  budget with spending trends over time
                </li>
                <li>View data by month, quarter, or year</li>
                <li>
                  Visual indicators show over/under budget categories and overall household
                  performance
                </li>
                <li>Track spending patterns and trends over time</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="strategy">
          <AccordionTrigger>Budget Setting Strategy</AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="pt-0 pb-4 px-4">
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Review historical spending data to establish realistic baselines</li>
                <li>Start with conservative estimates and adjust based on actual patterns</li>
                <li>
                  Separate essential expenses (housing, utilities) from discretionary spending
                </li>
                <li>Build in a buffer for unexpected expenses</li>
                <li>Review and adjust budgets quarterly based on changing needs</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Header and Filters */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Household Budget - {getPeriodLabel(timePeriod)}
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
                  onValueChange={(value: 'year' | 'month' | 'quarter') =>
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
                  </SelectContent>
                </Select>

                <Select
                  value={timePeriod.year.toString()}
                  onValueChange={(value) => setTimePeriod({ ...timePeriod, year: parseInt(value) })}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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

            {/* Category Filter - Only show for category audit */}
            {budgetType === 'category' && (
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
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={budgetType}
        onValueChange={(value) => setBudgetType(value as 'category' | 'household')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="category">Category Summary</TabsTrigger>
          <TabsTrigger value="household">Household Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="category" className="space-y-6">
          {categoryNoBudget ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">No Category Budgets Set</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      You need to set up budgets for your categories to track spending and get
                      budget audit insights.
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push('/dashboard/definitions/categories')}
                    className="inline-flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Set Up Category Budgets
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
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
                        <p className="text-sm font-medium text-muted-foreground">
                          Categories Over Budget
                        </p>
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
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(totalOverspend)}
                        </p>
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
                      <p className="text-muted-foreground">
                        No data available for the selected period
                      </p>
                    </div>
                  ) : (
                    <div className="w-full h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 30, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--foreground)"
                            opacity={0.5}
                          />
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
                            <td className="p-2 text-right">
                              {formatCurrency(item.actualSpending)}
                            </td>
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
            </>
          )}
        </TabsContent>

        <TabsContent value="household" className="space-y-6">
          {/* Household Summary Content */}
          {householdNoBudget ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">No Household Budget Set</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      You need to set up an annual budget for your household to track overall
                      spending and get budget audit insights.
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push('/dashboard/definitions/households')}
                    className="inline-flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Set Up Household Budget
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : householdData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Household Budget
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(householdData.periodBudget)}
                        </p>
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
                        <p className="text-lg font-bold">
                          {formatCurrency(householdData.totalSpending)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingDown
                        className={`h-4 w-4 ${householdData.totalSpending > householdData.periodBudget ? 'text-red-500' : 'text-green-500'}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {householdData.totalSpending > householdData.periodBudget
                            ? 'Over Budget'
                            : 'Budget Remaining'}
                        </p>
                        <p
                          className={`text-lg font-bold ${householdData.totalSpending > householdData.periodBudget ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {formatCurrency(
                            Math.abs(householdData.periodBudget - householdData.totalSpending)
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Daily Average</p>
                        <p className="text-lg font-bold">
                          {formatCurrency(householdData.dailyAverage)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Spending Over Time Chart */}
              <Card className="p-4">
                <CardHeader>
                  <CardTitle>Spending Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={householdData.spendingOverTime}
                        margin={{ top: 20, right: 30, left: 30, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--foreground)"
                          opacity={0.1}
                        />
                        <XAxis dataKey="date" tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
                        <YAxis
                          tickFormatter={(value) => formatCurrency(value)}
                          tick={{ fill: 'var(--foreground)' }}
                        />
                        <Tooltip content={<LineChartTooltip />} />
                        <ReferenceLine
                          y={householdData.periodBudget}
                          stroke="#94a3b8"
                          strokeDasharray="8 8"
                          label={{
                            value: 'Budget',
                            position: 'insideTopRight',
                            fill: 'var(--foreground)',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="budgetProgress"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          name="Budget Progress"
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativeAmount"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', r: 3 }}
                          activeDot={{ r: 5 }}
                          name="Actual Spending"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top 10 Transactions */}
              <Card className="p-4">
                <CardHeader>
                  <CardTitle>Top 10 Highest Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-left p-2">Category</th>
                          <th className="text-right p-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {householdData.topTransactions.map((transaction) => (
                          <tr key={transaction.id} className="border-b">
                            <td className="p-2">{transaction.date}</td>
                            <td className="p-2 font-medium">{transaction.description}</td>
                            <td className="p-2">{transaction.category}</td>
                            <td className="p-2 text-right font-medium">
                              {formatCurrency(Math.abs(transaction.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
