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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Filter, Loader2 } from 'lucide-react'
import {
  formatCurrency,
  getDateRange,
  getMonthName,
  getCurrentYear,
  getCurrentMonth,
  getCurrentQuarter,
  formatDateFromISO,
} from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'

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

interface TimePeriod {
  type: 'year' | 'month' | 'quarter'
  year: number
  month: number
  quarter: number
}

interface Transaction {
  id: string
  description: string
  amount: number
  transactionDate: string
  postDate: string
  account?: {
    name: string
  }
  user?: {
    name: string
  }
  category?: {
    name: string
  }
  type?: {
    name: string
    isOutflow: boolean
  }
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function AnalyticsBreakdown() {
  const { selectedHousehold } = useHousehold()
  const [data, setData] = useState<AnalyticsData[]>([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState('category')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>({
    type: 'month',
    year: getCurrentYear(),
    month: getCurrentMonth(),
    quarter: getCurrentQuarter(),
  })
  const [typeFilter, setTypeFilter] = useState('all')
  const [types, setTypes] = useState<TransactionType[]>([])
  const [transactions, setTransactions] = useState<Record<string, Transaction[]>>({})
  const [loadingTransactions, setLoadingTransactions] = useState<Record<string, boolean>>({})

  // Generate static year list for last 5 years
  const yearOptions = Array.from({ length: 5 }, (_, i) => getCurrentYear() - i)

  // Helper function to convert timePeriod to start/end dates
  const getDateRangeFromPeriod = (period: TimePeriod): { startDate: string; endDate: string } => {
    return getDateRange(period.type, period.year, period.month, period.quarter)
  }

  const fetchAnalytics = async () => {
    if (!selectedHousehold) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        groupBy,
        householdId: selectedHousehold.id,
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
        // Clear transactions when data changes
        setTransactions({})
        setLoadingTransactions({})
      } else {
        console.error('API Error:', await response.json())
        setData([])
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactionsForGroup = async (groupName: string) => {
    if (!selectedHousehold || transactions[groupName]) return

    setLoadingTransactions((prev) => ({ ...prev, [groupName]: true }))

    try {
      const params = new URLSearchParams({
        householdId: selectedHousehold.id,
        limit: '1000', // Get all transactions for the group
      })

      const dateRange = getDateRangeFromPeriod(timePeriod)
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter)

      // Add the appropriate filter based on groupBy
      if (groupBy === 'category') {
        // Find the category ID from the data
        const categories = await fetch(`/api/categories?householdId=${selectedHousehold.id}`)
        const categoriesData = (await categories.json()) as Array<{ id: string; name: string }>
        const category = categoriesData.find((c) => c.name === groupName)
        if (category) params.append('category', category.id)
      } else if (groupBy === 'user') {
        // Find the user ID from the data
        const users = await fetch(`/api/users?householdId=${selectedHousehold.id}`)
        const usersData = (await users.json()) as Array<{ id: string; name: string }>
        const user = usersData.find((u) => u.name === groupName)
        if (user) params.append('user', user.id)
      } else if (groupBy === 'account') {
        // Find the account ID from the data
        const accounts = await fetch(`/api/accounts?householdId=${selectedHousehold.id}`)
        const accountsData = (await accounts.json()) as Array<{ id: string; name: string }>
        const account = accountsData.find((a) => a.name === groupName)
        if (account) params.append('account', account.id)
      }

      const response = await fetch(`/api/transactions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTransactions((prev) => ({ ...prev, [groupName]: data.transactions }))
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoadingTransactions((prev) => ({ ...prev, [groupName]: false }))
    }
  }

  // Fetch types and date ranges when household changes
  useEffect(() => {
    const fetchTypes = async () => {
      if (!selectedHousehold) return
      try {
        const response = await fetch(`/api/types?householdId=${selectedHousehold.id}`)
        if (response.ok) {
          const data = await response.json()
          setTypes(data)
        }
      } catch (error) {
        console.error('Error fetching types:', error)
      }
    }

    if (selectedHousehold) {
      fetchTypes()
    }
  }, [selectedHousehold])

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, timePeriod, typeFilter, selectedHousehold])

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

  if (!selectedHousehold) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please select a household to view analytics.
      </div>
    )
  }

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
                    setTimePeriod((prev) => ({
                      ...prev,
                      type: value as 'year' | 'month' | 'quarter',
                    }))
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="year">By Year</SelectItem>
                    <SelectItem value="month">By Month</SelectItem>
                    <SelectItem value="quarter">By Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(timePeriod.type === 'year' ||
                timePeriod.type === 'month' ||
                timePeriod.type === 'quarter') && (
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
                      {yearOptions.map((year) => (
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

              {timePeriod.type === 'quarter' && (
                <div>
                  <Label htmlFor="quarter" className="text-sm font-medium">
                    Quarter:
                  </Label>
                  <Select
                    value={timePeriod.quarter.toString()}
                    onValueChange={(value) =>
                      setTimePeriod((prev) => ({ ...prev, quarter: parseInt(value) }))
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
                <h4 className="font-medium text-foreground mb-3">Breakdown:</h4>
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  onValueChange={(value) => {
                    if (value) {
                      fetchTransactionsForGroup(value)
                    }
                  }}
                >
                  {data.map((item, index) => (
                    <AccordionItem key={item.name} value={item.name} className="border-none">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex justify-between items-center w-full pr-4">
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
                            <div className="text-xs text-muted-foreground">
                              {item.count} transactions
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4">
                        {loadingTransactions[item.name] ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : transactions[item.name] ? (
                          <div className="mt-4 space-y-2">
                            <div className="text-xs text-muted-foreground mb-2">
                              Individual transactions:
                            </div>
                            <div className="max-h-96 overflow-auto">
                              <table className="w-full text-xs">
                                <thead className="border-b">
                                  <tr>
                                    <th className="text-left py-2">Date</th>
                                    <th className="text-left py-2">Description</th>
                                    {groupBy !== 'account' && (
                                      <th className="text-left py-2">Account</th>
                                    )}
                                    {groupBy !== 'category' && (
                                      <th className="text-left py-2">Category</th>
                                    )}
                                    {groupBy !== 'user' && <th className="text-left py-2">User</th>}
                                    <th className="text-right py-2">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {transactions[item.name].map((transaction) => (
                                    <tr key={transaction.id} className="border-b">
                                      <td className="py-2">
                                        {formatDateFromISO(transaction.transactionDate)}
                                      </td>
                                      <td className="py-2">{transaction.description}</td>
                                      {groupBy !== 'account' && (
                                        <td className="py-2">{transaction.account?.name || '-'}</td>
                                      )}
                                      {groupBy !== 'category' && (
                                        <td className="py-2">
                                          {transaction.category?.name || '-'}
                                        </td>
                                      )}
                                      {groupBy !== 'user' && (
                                        <td className="py-2">
                                          {transaction.user?.name || 'Household'}
                                        </td>
                                      )}
                                      <td
                                        className={`py-2 text-right font-medium ${
                                          transaction.type?.isOutflow
                                            ? 'text-red-600'
                                            : 'text-green-600'
                                        }`}
                                      >
                                        {formatCurrency(transaction.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
