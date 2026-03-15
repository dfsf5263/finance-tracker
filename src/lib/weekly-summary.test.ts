import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/analytics', () => ({
  getTransactionAnalytics: vi.fn(),
  hasTransactionsInPeriod: vi.fn(),
}))
vi.mock('@/lib/budget-analytics', () => ({
  getHouseholdBudgetPerformance: vi.fn(),
  getCategoryBudgetPerformance: vi.fn(),
  getUserBudgetPerformance: vi.fn(),
}))
vi.mock('@/lib/user-analytics', () => ({
  getHouseholdUsers: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}))

import { generateHouseholdSummary } from '@/lib/weekly-summary'
import { getTransactionAnalytics, hasTransactionsInPeriod } from '@/lib/analytics'
import {
  getHouseholdBudgetPerformance,
  getCategoryBudgetPerformance,
  getUserBudgetPerformance,
} from '@/lib/budget-analytics'
import { getHouseholdUsers } from '@/lib/user-analytics'

const mockHasTransactions = vi.mocked(hasTransactionsInPeriod)
const mockGetAnalytics = vi.mocked(getTransactionAnalytics)
const mockGetHouseholdBudget = vi.mocked(getHouseholdBudgetPerformance)
const mockGetCategoryBudget = vi.mocked(getCategoryBudgetPerformance)
const mockGetUserBudget = vi.mocked(getUserBudgetPerformance)
const mockGetUsers = vi.mocked(getHouseholdUsers)

const spendingData = [
  { name: 'Food', value: -300, count: 10 },
  { name: 'Transport', value: -100, count: 5 },
  { name: 'Utilities', value: -50, count: 3 },
]

function setupDefaults() {
  mockHasTransactions.mockResolvedValue(true)
  mockGetAnalytics.mockResolvedValue(spendingData)
  mockGetHouseholdBudget.mockResolvedValue({ noBudget: true })
  mockGetCategoryBudget.mockResolvedValue([])
  mockGetUsers.mockResolvedValue([])
}

describe('generateHouseholdSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('returns null when no transactions in period', async () => {
    mockHasTransactions.mockResolvedValue(false)

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    expect(result).toBeNull()
    expect(mockGetAnalytics).not.toHaveBeenCalled()
  })

  it('uses "review" period type on day 3 of month (days 1-7)', async () => {
    // Fix date to the 3rd of a month
    vi.setSystemTime(new Date('2024-03-03T12:00:00.000Z'))

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    expect(result).not.toBeNull()
    expect(result!.period.type).toBe('review')
    // Should report on February (previous month)
    expect(result!.period.monthName).toBe('February')
  })

  it('uses "current" period type on day 15 of month (days 8-31)', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    expect(result).not.toBeNull()
    expect(result!.period.type).toBe('current')
    expect(result!.period.monthName).toBe('March')
  })

  it('calculates top 5 categories by spending descending', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
    mockGetAnalytics.mockResolvedValue([
      { name: 'Food', value: -300, count: 10 },
      { name: 'Entertainment', value: -200, count: 8 },
      { name: 'Transport', value: -150, count: 6 },
      { name: 'Utilities', value: -100, count: 4 },
      { name: 'Healthcare', value: -50, count: 2 },
      { name: 'Other', value: -25, count: 1 }, // 6th - should be excluded
    ])

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    expect(result!.topCategories).toHaveLength(5)
    expect(result!.topCategories[0].name).toBe('Food')
    expect(result!.topCategories[0].amount).toBe(300)
  })

  it('calculates cashFlow income and expenses', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
    mockGetAnalytics.mockResolvedValue([
      { name: 'Salary', value: 2000, count: 2 }, // income
      { name: 'Food', value: -300, count: 10 }, // expense
      { name: 'Rent', value: -1000, count: 1 }, // expense
    ])

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    expect(result!.cashFlow.income).toBe(2000)
    expect(result!.cashFlow.expenses).toBe(1300)
    expect(result!.cashFlow.netFlow).toBe(700) // 2000 - 1300
    expect(result!.cashFlow.isPositive).toBe(true)
  })

  it('generates critical budget alert when household spending > 100%', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
    mockGetHouseholdBudget.mockResolvedValue({
      noBudget: false,
      periodBudget: 1000,
      totalSpending: 1200,
      budgetUsedPercentage: 120,
    })

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    const householdAlert = result!.budgetAlerts.find((a) => a.type === 'household')
    expect(householdAlert).toBeDefined()
    expect(householdAlert!.severity).toBe('critical')
  })

  it('generates warning budget alert when household spending is 80-100%', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
    mockGetHouseholdBudget.mockResolvedValue({
      noBudget: false,
      periodBudget: 1000,
      totalSpending: 850,
      budgetUsedPercentage: 85,
    })

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    const householdAlert = result!.budgetAlerts.find((a) => a.type === 'household')
    expect(householdAlert!.severity).toBe('warning')
  })

  it('generates info budget alert when household spending is 50-80%', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
    mockGetHouseholdBudget.mockResolvedValue({
      noBudget: false,
      periodBudget: 1000,
      totalSpending: 600,
      budgetUsedPercentage: 60,
    })

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    const householdAlert = result!.budgetAlerts.find((a) => a.type === 'household')
    expect(householdAlert!.severity).toBe('info')
  })

  it('sorts budget alerts critical first', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
    mockGetHouseholdBudget.mockResolvedValue({
      noBudget: false,
      periodBudget: 1000,
      totalSpending: 600,
      budgetUsedPercentage: 60,
    })
    mockGetCategoryBudget.mockResolvedValue([
      {
        categoryName: 'Food',
        periodBudget: 200,
        actualSpending: 250,
        budgetUsedPercentage: 125,
        overspend: true,
        overspendAmount: 50,
      },
    ])

    const result = await generateHouseholdSummary('hh-1', 'My Home')
    // critical (category) should appear before info (household)
    expect(result!.budgetAlerts[0].severity).toBe('critical')
    expect(result!.budgetAlerts[1].severity).toBe('info')
  })

  it('returns correct householdId and householdName', async () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
    const result = await generateHouseholdSummary('hh-abc', 'Smith Family')
    expect(result!.householdId).toBe('hh-abc')
    expect(result!.householdName).toBe('Smith Family')
  })
})
