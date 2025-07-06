'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter } from 'lucide-react'
import {
  formatCurrency,
  getDateRange,
  getMonthName,
  getCurrentYear,
  getCurrentMonth,
} from '@/lib/utils'

interface AnalyticsData {
  name: string
  value: number
  originalValue?: number // Original value (can be negative)
  count: number
}

interface TransactionType {
  id: string
  name: string
}

interface DateRanges {
  years: number[]
  currentYear: number
  currentMonth: number
}

interface TimePeriod {
  type: 'all' | 'year' | 'month'
  year: number
  month: number
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function AnalyticsBreakdown() {
  const [data, setData] = useState<AnalyticsData[]>([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState('category')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>({
    type: 'month',
    year: getCurrentYear(),
    month: getCurrentMonth(),
  })
  const [typeFilter, setTypeFilter] = useState('all')
  const [types, setTypes] = useState<TransactionType[]>([])
  const [dateRanges, setDateRanges] = useState<DateRanges>({
    years: [],
    currentYear: getCurrentYear(),
    currentMonth: getCurrentMonth(),
  })

  // Helper function to convert timePeriod to start/end dates
  const getDateRangeFromPeriod = (period: TimePeriod): { startDate: string; endDate: string } => {
    return getDateRange(period.type, period.year, period.month)
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        groupBy,
      })

      const dateRange = getDateRangeFromPeriod(timePeriod)
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      if (typeFilter && typeFilter !== 'all') params.append('typeId', typeFilter)

      const response = await fetch(`/api/transactions/analytics?${params}`)
      if (response.ok) {
        const analyticsData = await response.json()
        // Transform data to ensure pie chart gets absolute values
        // while preserving original values for display
        const transformedData = analyticsData.map((item: AnalyticsData) => ({
          ...item,
          originalValue: item.value, // Preserve original value
          value: Math.abs(item.value), // Use absolute value for pie chart
        }))
        setData(transformedData)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch types and date ranges on mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await fetch('/api/types')
        if (response.ok) {
          const data = await response.json()
          setTypes(data)
        }
      } catch (error) {
        console.error('Error fetching types:', error)
      }
    }

    const fetchDateRanges = async () => {
      try {
        const response = await fetch('/api/transactions/date-ranges')
        if (response.ok) {
          const data = await response.json()
          setDateRanges(data)
          // Update initial time period with current data
          setTimePeriod((prev) => ({
            ...prev,
            year: data.currentYear,
            month: data.currentMonth,
          }))
        }
      } catch (error) {
        console.error('Error fetching date ranges:', error)
      }
    }

    fetchTypes()
    fetchDateRanges()
  }, [])

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, timePeriod, typeFilter])

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: AnalyticsData }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      // Use originalValue if available, otherwise use value
      const displayValue = data.originalValue !== undefined ? data.originalValue : data.value
      return (
        <div className="bg-card p-3 border border-gray-200 rounded-xl shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">Amount: {formatCurrency(displayValue)}</p>
          <p className="text-sm text-gray-600">Transactions: {data.count}</p>
        </div>
      )
    }
    return null
  }

  // Calculate total using original values if available
  const totalAmount = data.reduce((sum, item) => {
    const valueToUse = item.originalValue !== undefined ? item.originalValue : item.value
    return sum + valueToUse
  }, 0)

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <Label htmlFor="groupBy" className="text-sm font-medium">
                  View by:
                </Label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="typeFilter" className="text-sm font-medium">
                  Transaction Type:
                </Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <Label htmlFor="periodType" className="text-sm font-medium">
                  Time Period:
                </Label>
                <Select
                  value={timePeriod.type}
                  onValueChange={(value) =>
                    setTimePeriod((prev) => ({ ...prev, type: value as 'all' | 'year' | 'month' }))
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="year">By Year</SelectItem>
                    <SelectItem value="month">By Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(timePeriod.type === 'year' || timePeriod.type === 'month') && (
                <div>
                  <Label htmlFor="year" className="text-sm font-medium">
                    Year:
                  </Label>
                  <Select
                    value={timePeriod.year.toString()}
                    onValueChange={(value) =>
                      setTimePeriod((prev) => ({ ...prev, year: parseInt(value) }))
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
                </div>
              )}

              {timePeriod.type === 'month' && (
                <div>
                  <Label htmlFor="month" className="text-sm font-medium">
                    Month:
                  </Label>
                  <Select
                    value={timePeriod.month.toString()}
                    onValueChange={(value) =>
                      setTimePeriod((prev) => ({ ...prev, month: parseInt(value) }))
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
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No data available for the selected period
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="p-6">
              <CardTitle>
                Transactions by{' '}
                {groupBy === 'category' ? 'Category' : groupBy === 'user' ? 'User' : 'Account'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={110}
                      dataKey="value"
                      nameKey="name"
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-current"
                    >
                      <tspan
                        x="50%"
                        fontSize="24"
                        fontWeight="700"
                        className={totalAmount >= 0 ? 'fill-green-600' : 'fill-red-600'}
                      >
                        {formatCurrency(totalAmount)}
                      </tspan>
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-6">
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted rounded-xl">
                <span className="font-medium text-foreground">Total Amount:</span>
                <span
                  className={`text-xl font-bold ${totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Breakdown:</h4>
                {data.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center p-2 border-l-4 border-l-border"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-foreground">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
                        {formatCurrency(
                          item.originalValue !== undefined ? item.originalValue : item.value
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.count} transactions</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
