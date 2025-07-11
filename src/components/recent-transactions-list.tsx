'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Calendar, User, CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'
import { useActiveMonth } from '@/hooks/use-active-month'

interface Transaction {
  id: string
  description: string
  amount: number
  transactionDate: string
  category?: {
    name: string
  }
  user?: {
    name: string
  }
  account?: {
    name: string
  }
  type?: {
    name: string
    isOutflow: boolean
  }
}

interface RecentTransactionsData {
  transactions: Transaction[]
  totalCount: number
}

export function RecentTransactionsList() {
  const { selectedHousehold } = useHousehold()
  const { activeMonth, activeYear, monthName } = useActiveMonth(selectedHousehold?.id || null)
  const [data, setData] = useState<RecentTransactionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    const fetchRecentTransactions = async () => {
      setLoading(true)
      setError(null)

      try {
        // Calculate date range for active month
        const startDate = new Date(activeYear, activeMonth - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(activeYear, activeMonth, 0).toISOString().split('T')[0]

        // Get transactions for active month with higher limit to filter client-side
        const response = await fetch(
          `/api/transactions?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&limit=100&page=1`
        )

        if (response.ok) {
          const result = await response.json()
          const allTransactions = result.transactions || []

          // Filter to outflow transactions only and sort by amount descending
          const outflowTransactions = allTransactions
            .filter((transaction: Transaction) => transaction.type?.isOutflow === true)
            .sort((a: Transaction, b: Transaction) => Math.abs(b.amount) - Math.abs(a.amount))
            .slice(0, 10) // Take top 10

          setData({
            transactions: outflowTransactions,
            totalCount: result.pagination?.total || 0, // Total transactions for the month
          })
        } else {
          throw new Error('Failed to fetch transactions')
        }
      } catch (error) {
        console.error('Error fetching recent transactions:', error)
        setError('Failed to load recent transactions')
      } finally {
        setLoading(false)
      }
    }

    fetchRecentTransactions()
  }, [selectedHousehold?.id, activeMonth, activeYear])

  const formatDate = (dateString: string) => {
    // Handle date-only strings (YYYY-MM-DD) properly
    let date: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Parse date-only string without timezone conversion
      const [year, month, day] = dateString.split('-').map(Number)
      date = new Date(year, month - 1, day)
    } else {
      date = new Date(dateString)
    }

    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    }
  }

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type?.isOutflow) {
      return <TrendingDown className="h-4 w-4 text-red-500" />
    } else {
      return <TrendingUp className="h-4 w-4 text-green-500" />
    }
  }

  const getAmountColor = (transaction: Transaction) => {
    return transaction.type?.isOutflow ? 'text-red-600' : 'text-green-600'
  }

  if (loading) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Top Transactions for {monthName || 'Current Month'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-muted rounded-full"></div>
                  <div>
                    <div className="h-4 bg-muted rounded w-32 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-24"></div>
                  </div>
                </div>
                <div className="h-4 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Top Transactions for {monthName || 'Current Month'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.transactions.length === 0) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Top Transactions for {monthName || 'Current Month'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No outflow transactions this month</p>
            <p className="text-xs text-muted-foreground mt-1">
              Outflow transactions will appear here once you start spending
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          Top Transactions
          <Badge variant="outline" className="ml-2">
            {data.totalCount} total transactions
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Highest outflow transactions this month</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">{getTransactionIcon(transaction)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{transaction.description}</p>
                    {transaction.category && (
                      <Badge variant="secondary" className="text-xs">
                        {transaction.category.name}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(transaction.transactionDate)}
                    </div>

                    {transaction.user && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {transaction.user.name}
                      </div>
                    )}

                    {transaction.account && (
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {transaction.account.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <p className={`font-semibold ${getAmountColor(transaction)}`}>
                  {transaction.type?.isOutflow ? '-' : '+'}
                  {formatCurrency(Math.abs(transaction.amount))}
                </p>
                {transaction.type && (
                  <p className="text-xs text-muted-foreground">{transaction.type.name}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {data.transactions.length === 10 && (
          <div className="mt-4 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Showing top 10 outflow transactions this month
            </p>
            <button className="text-sm text-primary hover:underline mt-1">
              View all transactions →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
