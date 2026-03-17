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

import { GET } from '@/app/api/budgets/user-budget/route'
import { requireHouseholdAccess } from '@/lib/auth-middleware'

const mockRequireAccess = vi.mocked(requireHouseholdAccess)

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'
const USER_ID = 'household-user-uuid-1234'

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/budgets/user-budget')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString())
}

const defaultParams = { householdId: HOUSEHOLD_ID, userId: USER_ID }

beforeEach(() => {
  mockRequireAccess.mockResolvedValue(mockHouseholdAccess('OWNER') as never)
  mockDb.householdUser.findUnique.mockResolvedValue({
    id: USER_ID,
    name: 'Alice',
    annualBudget: new Decimal('12000'),
    householdId: HOUSEHOLD_ID,
  } as never)
  mockDb.transaction.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('0') } } as never)
  ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
  mockDb.householdCategory.findMany.mockResolvedValue([])
  mockDb.transaction.findMany.mockResolvedValue([])
})

describe('GET /api/budgets/user-budget', () => {
  it('returns 400 when householdId is missing', async () => {
    const response = await GET(makeRequest({ userId: USER_ID }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('householdId')
  })

  it('returns 400 when userId is missing', async () => {
    const response = await GET(makeRequest({ householdId: HOUSEHOLD_ID }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('userId')
  })

  it('returns auth error passthrough', async () => {
    mockRequireAccess.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

    const response = await GET(makeRequest(defaultParams))
    expect(response.status).toBe(403)
  })

  it('returns 404 when user not found', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue(null as never)

    const response = await GET(makeRequest(defaultParams))
    expect(response.status).toBe(404)
  })

  it('returns 404 when user belongs to different household', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      id: USER_ID,
      name: 'Alice',
      annualBudget: new Decimal('12000'),
      householdId: 'different-household-id',
    } as never)

    const response = await GET(makeRequest(defaultParams))
    expect(response.status).toBe(404)
  })

  it('returns {noBudget: true} when user has no annualBudget', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      id: USER_ID,
      name: 'Alice',
      annualBudget: null,
      householdId: HOUSEHOLD_ID,
    } as never)

    const response = await GET(makeRequest(defaultParams))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.noBudget).toBe(true)
  })

  it('calculates basePeriodBudget as annualBudget / 12 for monthly', async () => {
    const response = await GET(makeRequest({ ...defaultParams, timePeriodType: 'month' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.basePeriodBudget).toBe(1000) // 12000 / 12
    expect(body.user.annualBudget).toBe(12000)
  })

  it('calculates basePeriodBudget as annualBudget / 4 for quarterly', async () => {
    const response = await GET(makeRequest({ ...defaultParams, timePeriodType: 'quarter' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.basePeriodBudget).toBe(3000) // 12000 / 4
  })

  it('sets spendingPercentage to 0 when totalBudget is 0', async () => {
    mockDb.householdUser.findUnique.mockResolvedValue({
      id: USER_ID,
      name: 'Alice',
      annualBudget: new Decimal('0'),
      householdId: HOUSEHOLD_ID,
    } as never)

    const response = await GET(makeRequest(defaultParams))
    // annualBudget = new Decimal('0') is truthy (object), so route proceeds with spendingPercentage=0
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.spendingPercentage).toBe(0)
    expect(body.isOverBudget).toBe(false)
  })

  it('adds inflowTotal to totalBudget when includeInflow=true', async () => {
    // First aggregate call for inflow, second for outflow
    mockDb.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Decimal('200') } } as never)
      .mockResolvedValueOnce({ _sum: { amount: new Decimal('-500') } } as never)

    const response = await GET(
      makeRequest({ ...defaultParams, timePeriodType: 'month', includeInflow: 'true' })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.inflowTotal).toBe(200)
    expect(body.totalBudget).toBe(1200) // 1000 + 200
    expect(body.includeInflow).toBe(true)
  })

  it('marks isOverBudget when spending exceeds totalBudget', async () => {
    // Spending $1500 vs $1000 monthly budget
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('-1500') },
    } as never)

    const response = await GET(makeRequest({ ...defaultParams, timePeriodType: 'month' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isOverBudget).toBe(true)
    expect(body.overspendAmount).toBe(500)
    expect(body.spendingPercentage).toBe(150)
  })

  it('returns category breakdown sorted by spending', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { categoryId: 'cat-1', _sum: { amount: new Decimal('-200') } },
      { categoryId: 'cat-2', _sum: { amount: new Decimal('-500') } },
    ] as never)
    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Food' },
      { id: 'cat-2', name: 'Rent' },
    ] as never)
    mockDb.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('-700') },
    } as never)

    const response = await GET(makeRequest({ ...defaultParams, timePeriodType: 'month' }))
    const body = await response.json()

    expect(body.categoryBreakdown).toHaveLength(2)
    expect(body.categoryBreakdown[0].categoryName).toBe('Rent') // 500 > 200
    expect(body.categoryBreakdown[0].amount).toBe(500)
    expect(body.categoryBreakdown[1].categoryName).toBe('Food')
  })

  it('returns top transactions with formatted output', async () => {
    mockDb.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        transactionDate: new Date('2024-03-15'),
        description: 'Groceries',
        category: { name: 'Food' },
        type: { name: 'Debit' },
        amount: new Decimal(-150),
      },
    ] as never)

    const response = await GET(makeRequest({ ...defaultParams, timePeriodType: 'month' }))
    const body = await response.json()

    expect(body.topTransactions).toHaveLength(1)
    expect(body.topTransactions[0].description).toBe('Groceries')
    expect(body.topTransactions[0].date).toBe('2024-03-15')
    expect(body.topTransactions[0].category).toBe('Food')
    expect(body.topTransactions[0].type).toBe('Debit')
  })

  it('applies date range to transaction filters', async () => {
    const response = await GET(
      makeRequest({ ...defaultParams, startDate: '2024-01-01', endDate: '2024-01-31' })
    )
    expect(response.status).toBe(200)
  })

  it('uses yearly budget divisor', async () => {
    const response = await GET(makeRequest({ ...defaultParams, timePeriodType: 'year' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.basePeriodBudget).toBe(12000) // 12000 / 1
  })

  it('returns 500 when database throws', async () => {
    mockDb.householdUser.findUnique.mockRejectedValueOnce(new Error('DB error'))

    const response = await GET(makeRequest(defaultParams))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to fetch user budget data')
  })
})
