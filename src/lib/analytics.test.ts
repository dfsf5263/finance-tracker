import { describe, it, expect, vi } from 'vitest'
import { mockDb } from '@/test/mocks/db'
import { getTransactionAnalytics, hasTransactionsInPeriod } from '@/lib/analytics'
import { Decimal } from '@prisma/client/runtime/client'

vi.mock('@/lib/db', () => ({ db: mockDb }))

describe('getTransactionAnalytics', () => {
  it('returns empty array when no aggregations', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
    mockDb.householdCategory.findMany.mockResolvedValue([] as never)

    const result = await getTransactionAnalytics({
      householdId: 'hh-id',
      groupBy: 'category',
    })

    expect(result).toEqual([])
  })

  it('maps category aggregations to AnalyticsResult with names', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { categoryId: 'cat-1', _sum: { amount: new Decimal('150.00') }, _count: { _all: 3 } },
    ] as never)

    mockDb.householdCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Food & Dining' },
    ] as never)

    const result = await getTransactionAnalytics({
      householdId: 'hh-id',
      groupBy: 'category',
    })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Food & Dining')
    expect(result[0].value).toBe(150)
    expect(result[0].count).toBe(3)
  })

  it('calls householdUser.findMany for groupBy=user', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: 'user-1', _sum: { amount: new Decimal('200.00') }, _count: { _all: 5 } },
    ] as never)

    mockDb.householdUser.findMany.mockResolvedValue([{ id: 'user-1', name: 'Alice' }] as never)

    const result = await getTransactionAnalytics({
      householdId: 'hh-id',
      groupBy: 'user',
    })

    expect(mockDb.householdUser.findMany).toHaveBeenCalledOnce()
    expect(result[0].name).toBe('Alice')
  })

  it('falls back to Household label for null userId', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: null, _sum: { amount: new Decimal('100.00') }, _count: { _all: 2 } },
    ] as never)

    mockDb.householdUser.findMany.mockResolvedValue([] as never)

    const result = await getTransactionAnalytics({
      householdId: 'hh-id',
      groupBy: 'user',
    })

    expect(result[0].name).toBe('Household')
  })

  it('calls householdAccount.findMany for groupBy=account', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { accountId: 'acct-1', _sum: { amount: new Decimal('500.00') }, _count: { _all: 10 } },
    ] as never)

    mockDb.householdAccount.findMany.mockResolvedValue([
      { id: 'acct-1', name: 'Chase Checking' },
    ] as never)

    const result = await getTransactionAnalytics({
      householdId: 'hh-id',
      groupBy: 'account',
    })

    expect(mockDb.householdAccount.findMany).toHaveBeenCalledOnce()
    expect(result[0].name).toBe('Chase Checking')
    expect(result[0].value).toBe(500)
  })

  it('falls back to Unknown for unresolved category ID', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { categoryId: 'cat-unknown', _sum: { amount: new Decimal('50') }, _count: { _all: 1 } },
    ] as never)

    mockDb.householdCategory.findMany.mockResolvedValue([] as never)

    const result = await getTransactionAnalytics({
      householdId: 'hh-id',
      groupBy: 'category',
    })

    expect(result[0].name).toBe('Unknown')
  })

  it('applies date filters when provided', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([] as never)
    mockDb.householdCategory.findMany.mockResolvedValue([] as never)

    await getTransactionAnalytics({
      householdId: 'hh-id',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    })

    const call = (mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.where.transactionDate).toBeDefined()
    expect(call.where.transactionDate.gte).toEqual(new Date('2024-01-01'))
    expect(call.where.transactionDate.lte).toEqual(new Date('2024-01-31'))
  })

  it('applies typeId filter when provided', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([] as never)
    mockDb.householdCategory.findMany.mockResolvedValue([] as never)

    await getTransactionAnalytics({
      householdId: 'hh-id',
      typeId: 'type-1',
    })

    const call = (mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.where.typeId).toBe('type-1')
  })

  it('defaults groupBy to category when not specified', async () => {
    ;(mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([] as never)
    mockDb.householdCategory.findMany.mockResolvedValue([] as never)

    await getTransactionAnalytics({ householdId: 'hh-id' })

    const call = (mockDb.transaction.groupBy as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.by).toContain('categoryId')
  })
})

describe('hasTransactionsInPeriod', () => {
  it('returns true when transactions exist', async () => {
    mockDb.transaction.count.mockResolvedValue(5 as never)

    const result = await hasTransactionsInPeriod('hh-id')
    expect(result).toBe(true)
  })

  it('returns false when no transactions exist', async () => {
    mockDb.transaction.count.mockResolvedValue(0 as never)

    const result = await hasTransactionsInPeriod('hh-id')
    expect(result).toBe(false)
  })

  it('applies date filters when provided', async () => {
    mockDb.transaction.count.mockResolvedValue(1 as never)

    await hasTransactionsInPeriod('hh-id', '2024-01-01', '2024-01-31')

    const call = mockDb.transaction.count.mock.calls[0][0]
    expect(call?.where?.transactionDate?.gte).toEqual(new Date('2024-01-01'))
    expect(call?.where?.transactionDate?.lte).toEqual(new Date('2024-01-31'))
  })

  it('works with only startDate', async () => {
    mockDb.transaction.count.mockResolvedValue(1 as never)

    await hasTransactionsInPeriod('hh-id', '2024-01-01')

    const call = mockDb.transaction.count.mock.calls[0][0]
    expect(call?.where?.transactionDate?.gte).toEqual(new Date('2024-01-01'))
    expect(call?.where?.transactionDate?.lte).toBeUndefined()
  })

  it('works with only endDate', async () => {
    mockDb.transaction.count.mockResolvedValue(1 as never)

    await hasTransactionsInPeriod('hh-id', undefined, '2024-01-31')

    const call = mockDb.transaction.count.mock.calls[0][0]
    expect(call?.where?.transactionDate?.lte).toEqual(new Date('2024-01-31'))
  })
})
