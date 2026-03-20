'use client'

import { OnboardingCard } from '@/components/onboarding-card'
import { DashboardSummaryCards } from '@/components/dashboard-summary-cards'
import { MonthlySpendingChart } from '@/components/monthly-spending-chart'
import { CategoryBreakdownChart } from '@/components/category-breakdown-chart'
import { RecentTransactionsList } from '@/components/recent-transactions-list'
import { BudgetAlerts } from '@/components/budget-alerts'
import { useActiveMonth } from '@/hooks/use-active-month'
import { useHousehold } from '@/contexts/household-context'
import { Calendar, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export default function DashboardPage() {
  const { selectedHousehold } = useHousehold()
  const { monthName, activeYear, isCurrentMonth, loading } = useActiveMonth(
    selectedHousehold?.id || null
  )

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Onboarding Card */}
        <div className="px-4 lg:px-6">
          <OnboardingCard />
        </div>

        {/* Active Month Indicator */}
        {!loading && monthName && activeYear && !isCurrentMonth && (
          <div className="px-4 lg:px-6">
            <div className="bg-muted/50 border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Showing data for {monthName} {activeYear}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    We&apos;re showing data for the most recent month with at least 5 days of
                    transaction activity. This ensures you see meaningful insights based on your
                    actual spending patterns.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Financial Summary Cards */}
        <DashboardSummaryCards />

        {/* Main Charts Section */}
        <div className="px-4 lg:px-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Monthly Spending Trend */}
            <div className="xl:col-span-2">
              <MonthlySpendingChart />
            </div>

            {/* Category Breakdown */}
            <div className="xl:col-span-2">
              <CategoryBreakdownChart />
            </div>
          </div>
        </div>

        {/* Bottom Section - Budget Alerts & Recent Activity */}
        <div className="px-4 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget Alerts */}
            <BudgetAlerts />

            {/* Recent Transactions */}
            <RecentTransactionsList />
          </div>
        </div>
      </div>
    </div>
  )
}
