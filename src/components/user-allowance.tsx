'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
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
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  Settings,
  DollarSign,
  Check,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'
import {
  formatCurrency,
  getDateRange,
  getMonthName,
  getCurrentYear,
  getCurrentMonth,
} from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'

interface UserAllowanceData {
  user: {
    id: string
    name: string
    annualBudget: number
  }
  basePeriodBudget: number
  inflowTotal: number
  totalAllowance: number
  totalSpending: number
  remainingAllowance: number
  spendingPercentage: number
  isOverBudget: boolean
  overspendAmount: number
  categoryBreakdown: {
    categoryId: string | null
    categoryName: string
    amount: number
  }[]
  topTransactions: {
    id: string
    date: string
    description: string
    category: string
    type: string
    amount: number
  }[]
  includeInflow: boolean
}

interface HouseholdUser {
  id: string
  name: string
  annualBudget: string | null
}

type TimePeriodType = 'month' | 'quarter' | 'year'

interface TimePeriod {
  type: TimePeriodType
  year: number
  month?: number
  quarter?: number
}

export function UserAllowance() {
  const router = useRouter()
  const { selectedHousehold } = useHousehold()
  const [data, setData] = useState<UserAllowanceData | null>(null)
  const [users, setUsers] = useState<HouseholdUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noBudget, setNoBudget] = useState(false)

  // Filter state
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [includeInflow, setIncludeInflow] = useState(false)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>({
    type: 'month',
    year: getCurrentYear(),
    month: getCurrentMonth(),
  })

  // Static years for dropdown
  const currentYear = getCurrentYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Fetch users with budgets
  useEffect(() => {
    if (!selectedHousehold?.id) return

    const fetchUsers = async () => {
      try {
        const response = await fetch(`/api/users?householdId=${selectedHousehold.id}`)
        if (!response.ok) throw new Error('Failed to fetch users')

        const allUsers: HouseholdUser[] = await response.json()
        const usersWithBudgets = allUsers.filter((user) => user.annualBudget !== null)

        setUsers(usersWithBudgets)

        // Auto-select first user if available
        if (usersWithBudgets.length > 0 && !selectedUser) {
          setSelectedUser(usersWithBudgets[0].id)
        }
      } catch (error) {
        console.error('Error fetching users:', error)
        setError('Failed to fetch users')
      }
    }

    fetchUsers()
  }, [selectedHousehold?.id, selectedUser])

  // Fetch allowance data
  useEffect(() => {
    if (!selectedHousehold?.id || !selectedUser) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      setNoBudget(false)

      try {
        const { startDate, endDate } = getDateRange(
          timePeriod.type,
          timePeriod.year,
          timePeriod.month,
          timePeriod.quarter
        )
        const params = new URLSearchParams({
          householdId: selectedHousehold.id,
          userId: selectedUser,
          timePeriodType: timePeriod.type,
          includeInflow: includeInflow.toString(),
        })

        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)

        const response = await fetch(`/api/budgets/allowance?${params}`)
        if (!response.ok) throw new Error('Failed to fetch allowance data')

        const result = await response.json()

        if (result.noBudget) {
          setNoBudget(true)
          setData(null)
        } else {
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching allowance data:', error)
        setError('Failed to fetch allowance data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedHousehold?.id, selectedUser, timePeriod, includeInflow])

  const handleUserChange = (userId: string) => {
    setSelectedUser(userId)
  }

  const handleTimePeriodChange = (type: TimePeriodType, value: number) => {
    setTimePeriod((prev) => {
      const newPeriod: TimePeriod = { ...prev, type }

      if (type === 'month') {
        newPeriod.month = value
      } else if (type === 'quarter') {
        newPeriod.quarter = value
        delete newPeriod.month
      } else if (type === 'year') {
        newPeriod.year = value
        delete newPeriod.month
        delete newPeriod.quarter
      }

      return newPeriod
    })
  }

  const handleYearChange = (year: number) => {
    setTimePeriod((prev) => ({ ...prev, year }))
  }

  const getPeriodLabel = (period: TimePeriod) => {
    switch (period.type) {
      case 'month':
        return `${getMonthName(period.month!)} ${period.year}`
      case 'quarter':
        return `Q${period.quarter} ${period.year}`
      case 'year':
        return period.year.toString()
      default:
        return 'Current Period'
    }
  }

  const getPieChartData = () => {
    if (!data) return []

    // Create data for each category
    const categoryColors = [
      '#ef4444', // Red
      '#f59e0b', // Amber
      '#3b82f6', // Blue
      '#10b981', // Green
      '#8b5cf6', // Purple
      '#f97316', // Orange
      '#06b6d4', // Cyan
      '#84cc16', // Lime
    ]

    const pieData = data.categoryBreakdown.slice(0, 8).map((category, index) => {
      return {
        name: category.categoryName,
        value: category.amount,
        fill: categoryColors[index % categoryColors.length],
      }
    })

    // Add remaining budget slice if there's remaining allowance
    if (data.remainingAllowance > 0 && !data.isOverBudget) {
      pieData.push({
        name: 'Remaining Budget',
        value: data.remainingAllowance,
        fill: 'transparent',
      })
    }

    return pieData
  }

  const getBudgetStatus = () => {
    if (!data)
      return {
        icon: Target,
        color: 'text-gray-600',
        message: 'Unknown',
        iconColor: 'text-gray-500',
      }

    const percentage = data.spendingPercentage

    if (percentage >= 100 || data.isOverBudget) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        message: 'Exceeded Budget',
        iconColor: 'text-red-500',
      }
    } else if (percentage >= 80) {
      return {
        icon: AlertTriangle,
        color: 'text-amber-600',
        message: 'Near Threshold',
        iconColor: 'text-amber-500',
      }
    } else {
      return {
        icon: Check,
        color: 'text-green-600',
        message: 'On Target',
        iconColor: 'text-green-500',
      }
    }
  }

  if (users.length === 0 && !loading) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            User Allowance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No User Budgets Found</h3>
            <p className="text-muted-foreground mb-4">
              To use the allowance tracker, you need to set annual budgets for users.
            </p>
            <Button onClick={() => router.push('/dashboard/definitions/users')}>
              <Settings className="h-4 w-4 mr-2" />
              Set User Budgets
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            User Allowance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading allowance data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            User Allowance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (noBudget) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            User Allowance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Budget Set</h3>
            <p className="text-muted-foreground mb-4">
              The selected user doesn&apos;t have an annual budget set.
            </p>
            <Button onClick={() => router.push('/dashboard/definitions/users')}>
              <Settings className="h-4 w-4 mr-2" />
              Set User Budget
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            User Allowance - {getPeriodLabel(timePeriod)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* User Filter */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-select">User</Label>
              <Select value={selectedUser} onValueChange={handleUserChange}>
                <SelectTrigger id="user-select" className="w-48">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Period Filter */}
            <div className="flex flex-col gap-2">
              <Label>Period Type</Label>
              <Select
                value={timePeriod.type}
                onValueChange={(value: TimePeriodType) =>
                  handleTimePeriodChange(value, timePeriod.year)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year Filter */}
            <div className="flex flex-col gap-2">
              <Label>Year</Label>
              <Select
                value={timePeriod.year.toString()}
                onValueChange={(year) => handleYearChange(parseInt(year))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month/Quarter Filter */}
            {timePeriod.type === 'month' && (
              <div className="flex flex-col gap-2">
                <Label>Month</Label>
                <Select
                  value={timePeriod.month?.toString() || ''}
                  onValueChange={(month) => handleTimePeriodChange('month', parseInt(month))}
                >
                  <SelectTrigger className="w-32">
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
              <div className="flex flex-col gap-2">
                <Label>Quarter</Label>
                <Select
                  value={timePeriod.quarter?.toString() || ''}
                  onValueChange={(quarter) => handleTimePeriodChange('quarter', parseInt(quarter))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((quarter) => (
                      <SelectItem key={quarter} value={quarter.toString()}>
                        Q{quarter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Include Inflow Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="include-inflow"
                checked={includeInflow}
                onCheckedChange={setIncludeInflow}
              />
              <Label htmlFor="include-inflow" className="text-sm">
                Include Inflow
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-medium">Include Inflow Transactions</p>
                    <p className="text-sm">
                      When enabled, this adds any income transactions (salary, bonuses, etc.) to
                      your allowance calculation for this period.
                    </p>
                    <p className="text-sm">
                      💡 <strong>Financial Tip:</strong> Consider saving or investing any surplus
                      income instead of increasing your spending allowance!
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Budget Status Card - First Position */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              {(() => {
                const status = getBudgetStatus()
                const IconComponent = status.icon
                return <IconComponent className={`h-4 w-4 ${status.iconColor}`} />
              })()}
              <span className="text-sm font-medium text-muted-foreground">Budget Status</span>
            </div>
            <div className={`text-2xl font-bold ${getBudgetStatus().color}`}>
              {getBudgetStatus().message}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.spendingPercentage.toFixed(1)}% of budget used
            </p>
          </CardContent>
        </Card>

        {/* Total Allowance Card - Second Position */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Total Allowance</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(data.totalAllowance)}</div>
            {data.includeInflow && data.inflowTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                Base: {formatCurrency(data.basePeriodBudget)} + Inflow:{' '}
                {formatCurrency(data.inflowTotal)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Spent Card - Third Position */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Total Spent</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(data.totalSpending)}</div>
            <p className="text-xs text-muted-foreground">
              {data.spendingPercentage.toFixed(1)}% of allowance
            </p>
          </CardContent>
        </Card>

        {/* Remaining/Overspent Card - Fourth Position */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              {data.isOverBudget ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {data.isOverBudget ? 'Overspent' : 'Remaining'}
              </span>
            </div>
            <div
              className={`text-2xl font-bold ${data.isOverBudget ? 'text-red-600' : 'text-green-600'}`}
            >
              {formatCurrency(data.isOverBudget ? data.overspendAmount : data.remainingAllowance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Usage Chart */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Budget Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getPieChartData()}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={80}
                  paddingAngle={2}
                >
                  {getPieChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const pieData = payload[0].payload
                      const isRemainingBudget = pieData.name === 'Remaining Budget'

                      // Calculate percentage based on context
                      let percentage = 0
                      let percentageLabel = ''

                      if (isRemainingBudget) {
                        percentage =
                          data?.totalAllowance > 0 ? (pieData.value / data.totalAllowance) * 100 : 0
                        percentageLabel = 'of total budget'
                      } else {
                        percentage =
                          data?.totalSpending > 0 ? (pieData.value / data.totalSpending) * 100 : 0
                        percentageLabel = 'of spending'
                      }

                      return (
                        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
                          <p className="font-medium">{pieData.name}</p>
                          <p className="text-sm text-primary">
                            Amount: {formatCurrency(pieData.value)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {percentage.toFixed(1)}% {percentageLabel}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-lg font-bold"
                >
                  Budget Usage
                </text>
                <text
                  x="50%"
                  y="55%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-sm"
                >
                  {data.spendingPercentage.toFixed(1)}% spent
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              {formatCurrency(data.totalSpending)} of {formatCurrency(data.totalAllowance)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Top Transactions */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Top Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.topTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b">
                    <td className="p-2">{transaction.date}</td>
                    <td className="p-2">{transaction.description}</td>
                    <td className="p-2">{transaction.category}</td>
                    <td className="p-2 text-right font-medium text-red-600">
                      {formatCurrency(transaction.amount)}
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
