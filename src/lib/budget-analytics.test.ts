import { describe, it, expect, vi } from 'vitest'
import { mockDb } from '@/test/mocks/db'
import {
  getHouseholdBudgetPerformance,
  getCategoryBudgetPerformance,
  getUserBudgetPerformance,
} from '@/lib/budget-analytics'
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

  it('calculates quarterly budget correctly', async () => {
    // Annual $12,000 → quarterly $3,000
    mockDb.household.findUnique.mockResolvedValue({ annualBudget: new Decimal('12000') } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('2000') },
    } as never)

    const result = await getHouseholdBudgetPerformance(
      'hh-id', '2024-01-01', '2024-03-31', 'quarter'
    )

    expect(result.periodBudget).toBe(3000)
    expect(result.totalSpending).toBe(2000)
  })

  it('calculates yearly budget correctly', async () => {
    // Annual $12,000 → yearly $12,000
    mockDb.household.findUnique.mockResolvedValue({ annualBudget: new Decimal('12000') } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('10000') },
    } as never)

    const result = await getHouseholdBudgetPerformance(
      'hh-id', '2024-01-01', '2024-12-31', 'year'
    )

    expect(result.periodBudget).toBe(12000)
    expect(result.totalSpending).toBe(10000)
  })

  it('handles zero spending', async () => {
    mockDb.household.findUnique.mockResolvedValue({ annualBudget: new Decimal('12000') } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as never)

    const result = await getHouseholdBudgetPerformance('hh-id', '2024-01-01', '2024-01-31', 'month')

    expect(result.totalSpending).toBe(0)
    expect(result.budgetUsedPercentage).toBe(0)
    expect(result.isOverBudget).toBe(false)
  })
})

describe('getCategoryBudgetPerformance', () => {
  it('returns empty array when no categories have budgets', async () => {
    mockDb.householdCategory.findMany.mockResolvedValue([] as never)

    const result = await getCategoryBudgetPerformance('hh-id', '2024-01-01', '2024-01-31')
    expect(result).toEqual([])
  })

  it('calculates monthly budget per category', async () => {
    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Food', annualBudget: new Decimal('6000') },
    ] as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('-400') },
    } as never)

    const result = await getCategoryBudgetPerformance('hh-id', '2024-01-01', '2024-01-31', 'month')

    expect(result).toHaveLength(1)
    expect(result[0].categoryName).toBe('Food')
    expect(result[0].periodBudget).toBe(500) // 6000/12
    expect(result[0].actualSpending).toBe(400)
    expect(result[0].budgetUsedPercentage).toBe(80)
    expect(result[0].overspend).toBe(false)
  })

  it('flags overspend per category', async () => {
    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Dining', annualBudget: new Decimal('2400') },
    ] as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('-300') },
    } as never)

    const result = await getCategoryBudgetPerformance('hh-id', '2024-01-01', '2024-01-31', 'month')

    expect(result[0].periodBudget).toBe(200) // 2400/12
    expect(result[0].actualSpending).toBe(300)
    expect(result[0].overspend).toBe(true)
    expect(result[0].overspendAmount).toBe(100)
  })

  it('calculates quarterly budget per category', async () => {
    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Gas', annualBudget: new Decimal('4800') },
    ] as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('1000') },
    } as never)

    const result = await getCategoryBudgetPerformance(
      'hh-id', '2024-01-01', '2024-03-31', 'quarter'
    )

    expect(result[0].periodBudget).toBe(1200) // 4800/4
    expect(result[0].actualSpending).toBe(1000)
  })

  it('calculates yearly budget per category', async () => {
    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Rent', annualBudget: new Decimal('24000') },
    ] as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('24000') },
    } as never)

    const result = await getCategoryBudgetPerformance(
      'hh-id', '2024-01-01', '2024-12-31', 'year'
    )

    expect(result[0].periodBudget).toBe(24000) // 24000/1
  })

  it('handles multiple categories', async () => {
    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Food', annualBudget: new Decimal('6000') },
      { id: 'cat-2', name: 'Gas', annualBudget: new Decimal('3600') },
    ] as never)
    mockDb.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Decimal('400') } } as never)
      .mockResolvedValueOnce({ _sum: { amount: new Decimal('200') } } as never)

    const result = await getCategoryBudgetPerformance('hh-id', '2024-01-01', '2024-01-31', 'month')

    expect(result).toHaveLength(2)
    expect(result[0].categoryName).toBe('Food')
    expect(result[1].categoryName).toBe('Gas')
  })

  it('handles null spending amount', async () => {
    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Travel', annualBudget: new Decimal('12000') },
    ] as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as never)

    const result = await getCategoryBudgetPerformance('hh-id', '2024-01-01', '2024-01-31', 'month')

    expect(result[0].actualSpending).toBe(0)
    expect(result[0].budgetUsedPercentage).toBe(0)
    expect(result[0].overspend).toBe(false)
  })
})

describe('getUserBudgetPerformance', () => {
  it('returns { noBudget: true } when user has no annualBudget', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({ annualBudget: null } as never)

    const result = await getUserBudgetPerformance('hh-id', 'user-1', '2024-01-01', '2024-01-31')
    expect(result).toEqual({ noBudget: true })
  })

  it('returns { noBudget: true } when user is not found', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue(null as never)

    const result = await getUserBudgetPerformance('hh-id', 'user-1', '2024-01-01', '2024-01-31')
    expect(result).toEqual({ noBudget: true })
  })

  it('calculates monthly user budget performance', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      annualBudget: new Decimal('12000'),
    } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('-800') },
    } as never)

    const result = await getUserBudgetPerformance(
      'hh-id', 'user-1', '2024-01-01', '2024-01-31', 'month'
    )

    expect(result.noBudget).toBe(false)
    expect(result.totalBudget).toBe(1000) // 12000/12
    expect(result.totalSpending).toBe(800)
    expect(result.spendingPercentage).toBe(80)
    expect(result.isOverBudget).toBe(false)
  })

  it('flags user over-budget', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      annualBudget: new Decimal('6000'),
    } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('-600') },
    } as never)

    const result = await getUserBudgetPerformance(
      'hh-id', 'user-1', '2024-01-01', '2024-01-31', 'month'
    )

    expect(result.totalBudget).toBe(500) // 6000/12
    expect(result.totalSpending).toBe(600)
    expect(result.isOverBudget).toBe(true)
    expect(result.overspendAmount).toBe(100)
  })

  it('calculates quarterly user budget', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      annualBudget: new Decimal('12000'),
    } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('2500') },
    } as never)

    const result = await getUserBudgetPerformance(
      'hh-id', 'user-1', '2024-01-01', '2024-03-31', 'quarter'
    )

    expect(result.totalBudget).toBe(3000) // 12000/4
  })

  it('calculates yearly user budget', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      annualBudget: new Decimal('12000'),
    } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('10000') },
    } as never)

    const result = await getUserBudgetPerformance(
      'hh-id', 'user-1', '2024-01-01', '2024-12-31', 'year'
    )

    expect(result.totalBudget).toBe(12000) // 12000/1
  })

  it('handles null spending', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      annualBudget: new Decimal('12000'),
    } as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as never)

    const result = await getUserBudgetPerformance(
      'hh-id', 'user-1', '2024-01-01', '2024-01-31', 'month'
    )

    expect(result.totalSpending).toBe(0)
    expect(result.spendingPercentage).toBe(0)
    expect(result.isOverBudget).toBe(false)
  })
})
