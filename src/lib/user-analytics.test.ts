import { describe, it, expect, vi } from 'vitest'
import { mockDb } from '@/test/mocks/db'
import { getHouseholdUsers } from '@/lib/user-analytics'
import { Decimal } from '@prisma/client/runtime/client'

vi.mock('@/lib/db', () => ({ db: mockDb }))

describe('getHouseholdUsers', () => {
  it('returns users with annualBudget converted to string', async () => {
    mockDb.householdUser.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Alice', annualBudget: new Decimal('50000') },
      { id: 'user-2', name: 'Bob', annualBudget: new Decimal('30000') },
    ] as never)

    const result = await getHouseholdUsers('hh-id')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 'user-1', name: 'Alice', annualBudget: '50000' })
    expect(result[1]).toEqual({ id: 'user-2', name: 'Bob', annualBudget: '30000' })
  })

  it('returns null annualBudget for users without a budget', async () => {
    mockDb.householdUser.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Alice', annualBudget: null },
    ] as never)

    const result = await getHouseholdUsers('hh-id')

    expect(result[0].annualBudget).toBeNull()
  })

  it('returns empty array when household has no users', async () => {
    mockDb.householdUser.findMany.mockResolvedValue([] as never)

    const result = await getHouseholdUsers('hh-id')
    expect(result).toEqual([])
  })
})
