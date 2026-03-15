import { describe, it, expect, vi } from 'vitest'
import { mockDb } from '@/test/mocks/db'
import { getTransactionAnalytics } from '@/lib/analytics'
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
})
