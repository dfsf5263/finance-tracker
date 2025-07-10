import { OnboardingCard } from '@/components/onboarding-card'
import { DashboardSummaryCards } from '@/components/dashboard-summary-cards'
import { MonthlySpendingChart } from '@/components/monthly-spending-chart'
import { CategoryBreakdownChart } from '@/components/category-breakdown-chart'
import { RecentTransactionsList } from '@/components/recent-transactions-list'
import { BudgetAlerts } from '@/components/budget-alerts'

export default function DashboardPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Onboarding Card */}
        <div className="px-4 lg:px-6">
          <OnboardingCard />
        </div>

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

        {/* Bottom Section - Recent Activity & Alerts */}
        <div className="px-4 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Transactions */}
            <RecentTransactionsList />

            {/* Budget Alerts */}
            <BudgetAlerts />
          </div>
        </div>
      </div>
    </div>
  )
}
