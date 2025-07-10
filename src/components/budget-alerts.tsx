'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'
import { useActiveMonth } from '@/hooks/use-active-month'

interface CategoryAlert {
  type: 'category'
  severity: 'warning' | 'critical' | 'info'
  categoryName: string
  budgetUsed: number
  totalBudget: number
  percentageUsed: number
  overspendAmount?: number
}

interface UserAlert {
  type: 'user'
  severity: 'warning' | 'critical' | 'info'
  userName: string
  budgetUsed: number
  totalBudget: number
  percentageUsed: number
  overspendAmount?: number
}

interface HouseholdAlert {
  type: 'household'
  severity: 'warning' | 'critical' | 'info'
  message: string
  budgetUsed?: number
  totalBudget?: number
  percentageUsed?: number
}

type BudgetAlert = CategoryAlert | UserAlert | HouseholdAlert

export function BudgetAlerts() {
  const { selectedHousehold } = useHousehold()
  const { activeMonth, activeYear } = useActiveMonth(selectedHousehold?.id || null)
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedHousehold?.id || !activeMonth || !activeYear) return

    const fetchBudgetAlerts = async () => {
      setLoading(true)

      try {
        const currentYear = activeYear
        const currentMonth = activeMonth
        const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

        const newAlerts: BudgetAlert[] = []

        // Fetch household budget data
        const householdResponse = await fetch(
          `/api/budgets/household-budget?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&timePeriodType=month&budgetType=household`
        )

        if (householdResponse.ok) {
          const householdData = await householdResponse.json()

          if (!householdData.noBudget && householdData.periodBudget) {
            const percentage = (householdData.totalSpending / householdData.periodBudget) * 100

            if (percentage > 100) {
              newAlerts.push({
                type: 'household',
                severity: 'critical',
                message: 'Household budget exceeded this month',
                budgetUsed: householdData.totalSpending,
                totalBudget: householdData.periodBudget,
                percentageUsed: percentage,
              })
            } else if (percentage > 90) {
              newAlerts.push({
                type: 'household',
                severity: 'warning',
                message: 'Household budget nearly exhausted',
                budgetUsed: householdData.totalSpending,
                totalBudget: householdData.periodBudget,
                percentageUsed: percentage,
              })
            } else if (percentage > 75) {
              newAlerts.push({
                type: 'household',
                severity: 'info',
                message: 'Household spending on track',
                budgetUsed: householdData.totalSpending,
                totalBudget: householdData.periodBudget,
                percentageUsed: percentage,
              })
            }
          }
        }

        // Fetch category budget data
        const categoryResponse = await fetch(
          `/api/budgets/household-budget?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&timePeriodType=month&budgetType=category`
        )

        if (categoryResponse.ok) {
          const categoryData = await categoryResponse.json()

          if (Array.isArray(categoryData)) {
            categoryData.forEach(
              (category: {
                periodBudget: number
                budgetUsedPercentage: number
                overspend: boolean
                categoryName: string
                actualSpending: number
                overspendAmount?: number
              }) => {
                if (category.periodBudget && category.periodBudget > 0) {
                  const percentage = category.budgetUsedPercentage

                  if (category.overspend) {
                    newAlerts.push({
                      type: 'category',
                      severity: 'critical',
                      categoryName: category.categoryName,
                      budgetUsed: category.actualSpending,
                      totalBudget: category.periodBudget,
                      percentageUsed: percentage,
                      overspendAmount: category.overspendAmount,
                    })
                  } else if (percentage > 90) {
                    newAlerts.push({
                      type: 'category',
                      severity: 'warning',
                      categoryName: category.categoryName,
                      budgetUsed: category.actualSpending,
                      totalBudget: category.periodBudget,
                      percentageUsed: percentage,
                    })
                  }
                }
              }
            )
          }
        }

        // Fetch user budget data
        const usersResponse = await fetch(`/api/users?householdId=${selectedHousehold.id}`)

        if (usersResponse.ok) {
          const users = await usersResponse.json()
          const usersWithBudgets = users.filter(
            (user: { annualBudget: string | null }) => user.annualBudget
          )

          for (const user of usersWithBudgets) {
            try {
              const userBudgetResponse = await fetch(
                `/api/budgets/user-budget?householdId=${selectedHousehold.id}&userId=${user.id}&startDate=${startDate}&endDate=${endDate}&timePeriodType=month&includeInflow=false`
              )

              if (userBudgetResponse.ok) {
                const userData = await userBudgetResponse.json()

                if (!userData.noBudget) {
                  const percentage = userData.spendingPercentage

                  if (userData.isOverBudget) {
                    newAlerts.push({
                      type: 'user',
                      severity: 'critical',
                      userName: user.name,
                      budgetUsed: userData.totalSpending,
                      totalBudget: userData.totalBudget,
                      percentageUsed: percentage,
                      overspendAmount: userData.overspendAmount,
                    })
                  } else if (percentage > 90) {
                    newAlerts.push({
                      type: 'user',
                      severity: 'warning',
                      userName: user.name,
                      budgetUsed: userData.totalSpending,
                      totalBudget: userData.totalBudget,
                      percentageUsed: percentage,
                    })
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching budget for user ${user.name}:`, error)
            }
          }
        }

        // Sort alerts by severity (critical first, then warning, then info)
        const severityOrder = { critical: 0, warning: 1, info: 2 }
        newAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

        setAlerts(newAlerts)
      } catch (error) {
        console.error('Error fetching budget alerts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBudgetAlerts()
  }, [selectedHousehold?.id, activeMonth, activeYear])

  const getAlertVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive' as const
      case 'warning':
        return 'default' as const
      case 'info':
        return 'default' as const
      default:
        return 'default' as const
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600'
      case 'warning':
        return 'text-amber-600'
      case 'info':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const renderAlert = (alert: BudgetAlert, index: number) => {
    const variant = getAlertVariant(alert.severity)
    const iconColor = getSeverityColor(alert.severity)

    if (alert.type === 'household') {
      return (
        <Alert key={index} variant={variant}>
          {alert.severity === 'critical' && <AlertCircle className={`h-4 w-4 ${iconColor}`} />}
          {alert.severity === 'warning' && <AlertTriangle className={`h-4 w-4 ${iconColor}`} />}
          {alert.severity === 'info' && <CheckCircle className={`h-4 w-4 ${iconColor}`} />}
          <AlertTitle>{alert.message}</AlertTitle>
          <AlertDescription>
            {alert.budgetUsed && alert.totalBudget && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span>
                  {formatCurrency(alert.budgetUsed)} of {formatCurrency(alert.totalBudget)}
                </span>
                <Badge variant="outline">{alert.percentageUsed?.toFixed(1)}%</Badge>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )
    }

    if (alert.type === 'category') {
      return (
        <Alert key={index} variant={variant}>
          {alert.severity === 'critical' && <AlertCircle className={`h-4 w-4 ${iconColor}`} />}
          {alert.severity === 'warning' && <AlertTriangle className={`h-4 w-4 ${iconColor}`} />}
          {alert.severity === 'info' && <CheckCircle className={`h-4 w-4 ${iconColor}`} />}
          <AlertTitle>
            {alert.categoryName}{' '}
            {alert.overspendAmount ? (
              <>exceeded budget by {formatCurrency(alert.overspendAmount)}</>
            ) : (
              <>approaching budget limit</>
            )}
          </AlertTitle>
          <AlertDescription>
            <div className="flex items-center justify-between text-sm mt-2">
              <span>
                {formatCurrency(alert.budgetUsed)} of {formatCurrency(alert.totalBudget)} (
                {alert.percentageUsed.toFixed(1)}%)
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )
    }

    if (alert.type === 'user') {
      return (
        <Alert key={index} variant={variant}>
          {alert.severity === 'critical' && <AlertCircle className={`h-4 w-4 ${iconColor}`} />}
          {alert.severity === 'warning' && <AlertTriangle className={`h-4 w-4 ${iconColor}`} />}
          {alert.severity === 'info' && <CheckCircle className={`h-4 w-4 ${iconColor}`} />}
          <AlertTitle>
            {alert.userName}{' '}
            {alert.overspendAmount ? (
              <>exceeded personal budget by {formatCurrency(alert.overspendAmount)}</>
            ) : (
              <>approaching personal budget limit</>
            )}
          </AlertTitle>
          <AlertDescription>
            <div className="flex items-center justify-between text-sm mt-2">
              <span>
                {formatCurrency(alert.budgetUsed)} of {formatCurrency(alert.totalBudget)} (
                {alert.percentageUsed.toFixed(1)}%)
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )
    }

    return null
  }

  if (loading) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Budget Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 border rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-48"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          Budget Alerts
          {alerts.length > 0 && (
            <Badge
              variant={alerts.some((a) => a.severity === 'critical') ? 'destructive' : 'outline'}
            >
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">Budget performance notifications and alerts</p>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">All budgets on track</p>
            <p className="text-xs text-muted-foreground mt-1">No budget alerts for this month</p>
          </div>
        ) : (
          <div className="space-y-3">{alerts.map((alert, index) => renderAlert(alert, index))}</div>
        )}

        {alerts.length === 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Keep up the good financial management!</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
