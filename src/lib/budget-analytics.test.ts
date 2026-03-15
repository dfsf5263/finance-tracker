import { describe, it, expect, vi } from 'vitest'
import { mockDb } from '@/test/mocks/db'
import { getHouseholdBudgetPerformance } from '@/lib/budget-analytics'
import { Decimal } from '@prisma/client/runtime/client'

vi.mock('@/lib/db', () => ({ db: mockDb }))

describe('getHouseholdBudgetPerformance', () => {
  it('returns { noBudget: true } when household has no annualBudget', async () => {
    mockDb.household.findUnique.mockResolvedValue({ annualBudget: null } as never)

    const result = await getHouseholdBudgetPerformance('hh-id', '2024-01-01', '2024-01-31')
    expect(result).toEqual({ noBudget: true })
  })

  it('returns { noBudget: true } when household is not found', async () => {
    mockDb.household.findUnique.mockResolvedValue(null as never)

    const result = await getHouseholdBudgetPerformance('hh-id', '2024-01-01', '2024-01-31')
    expect(result).toEqual({ noBudget: true })
  })

  it('calculates monthly budget performance correctly', async () => {
    // Annual budget $12,000 → monthly $1,000
    mockDb.household.findUnique.mockResolvedValue({ annualBudget: new Decimal('12000') } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('800') },
    } as never)

    const result = await getHouseholdBudgetPerformance('hh-id', '2024-01-01', '2024-01-31', 'month')

    expect(result.noBudget).toBe(false)
    expect(result.periodBudget).toBe(1000)
    expect(result.totalSpending).toBe(800)
    expect(result.budgetUsedPercentage).toBe(80)
    expect(result.isOverBudget).toBe(false)
    expect(result.overspendAmount).toBeUndefined()
  })

  it('flags over-budget correctly', async () => {
    mockDb.household.findUnique.mockResolvedValue({ annualBudget: new Decimal('12000') } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('-1200') },
    } as never)

    const result = await getHouseholdBudgetPerformance('hh-id', '2024-01-01', '2024-01-31', 'month')

    expect(result.isOverBudget).toBe(true)
    expect(result.overspendAmount).toBeGreaterThan(0)
  })
})
