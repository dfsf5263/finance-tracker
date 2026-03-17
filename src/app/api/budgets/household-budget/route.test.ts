import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/test/mocks/db'
import { mockHouseholdAccess } from '@/test/mocks/auth'
import { Decimal } from '@prisma/client/runtime/client'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/auth-middleware', () => ({
  requireHouseholdAccess: vi.fn(),
}))
vi.mock('@/lib/middleware/with-api-logging', () => ({
  withApiLogging: (handler: unknown) => handler,
}))
vi.mock('@/lib/error-logger', () => ({
  logApiError: vi.fn(),
}))

import { GET } from '@/app/api/budgets/household-budget/route'
import { requireHouseholdAccess } from '@/lib/auth-middleware'

const mockRequireAccess = vi.mocked(requireHouseholdAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/budgets/household-budget')
  url.searchParams.set('householdId', HOUSEHOLD_ID)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString())
}

beforeEach(() => {
  mockRequireAccess.mockResolvedValue(mockHouseholdAccess('OWNER') as never)
})

describe('GET /api/budgets/household-budget', () => {
  it('returns 400 when householdId is missing', async () => {
    const request = new NextRequest('http://localhost/api/budgets/household-budget')
    const response = await GET(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('householdId')
  })

  it('returns auth error passthrough', async () => {
    mockRequireAccess.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

    const response = await GET(makeRequest({}))
    expect(response.status).toBe(403)
  })

  describe('budgetType=household', () => {
    it('returns {noBudget: true} when household has no annualBudget', async () => {
      mockDb.household.findUnique.mockResolvedValue({ annualBudget: null } as never)

      const response = await GET(makeRequest({ budgetType: 'household' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.noBudget).toBe(true)
    })

    it('calculates periodBudget as annualBudget / 12 for monthly', async () => {
      mockDb.household.findUnique.mockResolvedValue({
        annualBudget: new Decimal('12000'),
      } as never)
      mockDb.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('-500') },
      } as never)
      mockDb.transaction.findMany.mockResolvedValue([])

      const response = await GET(makeRequest({ budgetType: 'household', timePeriodType: 'month' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.periodBudget).toBe(1000) // 12000 / 12
      expect(body.householdBudget).toBe(12000)
    })

    it('calculates periodBudget as annualBudget / 4 for quarterly', async () => {
      mockDb.household.findUnique.mockResolvedValue({
        annualBudget: new Decimal('12000'),
      } as never)
      mockDb.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('0') },
      } as never)
      mockDb.transaction.findMany.mockResolvedValue([])

      const response = await GET(
        makeRequest({ budgetType: 'household', timePeriodType: 'quarter' })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.periodBudget).toBe(3000) // 12000 / 4
    })

    it('uses full annualBudget as periodBudget for yearly', async () => {
      mockDb.household.findUnique.mockResolvedValue({
        annualBudget: new Decimal('12000'),
      } as never)
      mockDb.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('0') },
      } as never)
      mockDb.transaction.findMany.mockResolvedValue([])

      const response = await GET(makeRequest({ budgetType: 'household', timePeriodType: 'year' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.periodBudget).toBe(12000) // 12000 / 1
    })
  })

  describe('budgetType=category (default)', () => {
    it('returns {noBudget: true} when no categories have budgets', async () => {
      mockDb.householdCategory.findMany.mockResolvedValue([])
      ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])

      const response = await GET(makeRequest({}))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.noBudget).toBe(true)
    })

    it('returns category budget array with correct calculations', async () => {
      mockDb.householdCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Food', annualBudget: new Decimal('1200') },
      ] as never)
      ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { categoryId: 'cat-1', _sum: { amount: new Decimal('-80') } },
      ] as never)

      const response = await GET(makeRequest({ timePeriodType: 'month' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toHaveLength(1)
      expect(body[0].categoryName).toBe('Food')
      expect(body[0].periodBudget).toBe(100) // 1200 / 12
      expect(body[0].actualSpending).toBe(80) // abs(-80)
      expect(body[0].budgetUsedPercentage).toBe(80) // 80/100 * 100
    })

    it('marks category as overspend when spending exceeds budget', async () => {
      mockDb.householdCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Food', annualBudget: new Decimal('1200') },
      ] as never)
      // Spending $200 against $100 monthly budget
      ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { categoryId: 'cat-1', _sum: { amount: new Decimal('-200') } },
      ] as never)

      const response = await GET(makeRequest({ timePeriodType: 'month' }))
      const body = await response.json()
      expect(body[0].overspend).toBe(true)
      expect(body[0].overspendAmount).toBe(100)
    })

    it('filters by specific categoryId', async () => {
      mockDb.householdCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Food', annualBudget: new Decimal('1200') },
      ] as never)
      ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { categoryId: 'cat-1', _sum: { amount: new Decimal('-50') } },
      ] as never)

      const response = await GET(makeRequest({ categoryId: 'cat-1', timePeriodType: 'month' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toHaveLength(1)
    })

    it('sorts overspend categories first, then by usage percentage', async () => {
      mockDb.householdCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Food', annualBudget: new Decimal('1200') },
        { id: 'cat-2', name: 'Entertainment', annualBudget: new Decimal('600') },
      ] as never)
      ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        // Food: $50 / $100 = 50%
        { categoryId: 'cat-1', _sum: { amount: new Decimal('-50') } },
        // Entertainment: $100 / $50 = 200% (overspend)
        { categoryId: 'cat-2', _sum: { amount: new Decimal('-100') } },
      ] as never)

      const response = await GET(makeRequest({ timePeriodType: 'month' }))
      const body = await response.json()
      // Overspend category comes first
      expect(body[0].categoryName).toBe('Entertainment')
      expect(body[0].overspend).toBe(true)
      expect(body[1].categoryName).toBe('Food')
    })
  })

  describe('budgetType=household with spending data', () => {
    it('returns spending overview with daily average and cumulative data', async () => {
      mockDb.household.findUnique.mockResolvedValue({
        annualBudget: new Decimal('12000'),
      } as never)
      mockDb.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('-1500') },
      } as never)
      // First findMany: spending over time
      mockDb.transaction.findMany
        .mockResolvedValueOnce([
          {
            transactionDate: new Date('2024-01-10'),
            amount: new Decimal('-500'),
          },
          {
            transactionDate: new Date('2024-01-15'),
            amount: new Decimal('-1000'),
          },
        ] as never)
        // Second findMany: top transactions
        .mockResolvedValueOnce([
          {
            id: 'tx-1',
            transactionDate: new Date('2024-01-10'),
            description: 'Rent',
            category: { name: 'Housing' },
            amount: new Decimal(-1000),
          },
        ] as never)

      const response = await GET(
        makeRequest({ budgetType: 'household', timePeriodType: 'month' })
      )
      expect(response.status).toBe(200)
      const body = await response.json()

      expect(body.householdBudget).toBe(12000)
      expect(body.periodBudget).toBe(1000)
      expect(body.totalSpending).toBe(1500)
      expect(body.dailyAverage).toBe(750) // 1500 / 2 days
      expect(body.spendingOverTime).toHaveLength(2)
      expect(body.spendingOverTime[0].date).toBe('2024-01-10')
      expect(body.spendingOverTime[1].cumulativeAmount).toBe(1500)
    })

    it('returns top transactions sorted by amount', async () => {
      mockDb.household.findUnique.mockResolvedValue({
        annualBudget: new Decimal('12000'),
      } as never)
      mockDb.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('-200') },
      } as never)
      // First findMany for spending over time
      mockDb.transaction.findMany
        .mockResolvedValueOnce([
          {
            transactionDate: new Date('2024-01-10'),
            amount: new Decimal('-200'),
          },
        ] as never)
        // Second findMany for top transactions
        .mockResolvedValueOnce([
          {
            id: 'tx-1',
            transactionDate: new Date('2024-01-10'),
            description: 'Big Purchase',
            category: { name: 'Shopping' },
            amount: new Decimal(-200),
          },
        ] as never)

      const response = await GET(
        makeRequest({ budgetType: 'household', timePeriodType: 'month' })
      )
      const body = await response.json()

      expect(body.topTransactions).toHaveLength(1)
      expect(body.topTransactions[0].description).toBe('Big Purchase')
      expect(body.topTransactions[0].category).toBe('Shopping')
    })

    it('applies date range to household budget queries', async () => {
      mockDb.household.findUnique.mockResolvedValue({
        annualBudget: new Decimal('12000'),
      } as never)
      mockDb.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('0') },
      } as never)
      mockDb.transaction.findMany.mockResolvedValue([] as never)

      const response = await GET(
        makeRequest({
          budgetType: 'household',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
      )
      expect(response.status).toBe(200)
    })
  })

  it('returns 500 when database throws', async () => {
    mockDb.household.findUnique.mockRejectedValueOnce(new Error('DB error'))

    const response = await GET(makeRequest({ budgetType: 'household' }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to fetch household budget data')
  })
})
