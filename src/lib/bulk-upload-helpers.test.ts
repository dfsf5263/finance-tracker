import { describe, it, expect } from 'vitest'
import {
  isoToUtcNoon,
  parseValidationErrors,
  checkIntraFileDuplicates,
  getEntityValidationFailures,
  filterOutEntityFailures,
} from '@/lib/bulk-upload-helpers'
import type { BulkTransaction } from '@/lib/validation/bulk-upload'

function makeTx(overrides: Partial<BulkTransaction> = {}): BulkTransaction {
  return {
    account: 'Chase Checking',
    transactionDate: '2024-01-15T00:00:00.000Z',
    description: 'Coffee Shop',
    category: 'Food',
    type: 'Purchase',
    amount: '12.50',
    ...overrides,
  }
}

describe('isoToUtcNoon', () => {
  it('converts an ISO date-only string to UTC noon', () => {
    const result = isoToUtcNoon('2024-01-15')
    expect(result.toISOString()).toBe('2024-01-15T12:00:00.000Z')
  })

  it('strips time portion of full ISO string before converting', () => {
    const result = isoToUtcNoon('2024-06-30T03:45:00.000Z')
    expect(result.toISOString()).toBe('2024-06-30T12:00:00.000Z')
  })
})

describe('parseValidationErrors', () => {
  it('parses transactions.N.field format', () => {
    const errors = parseValidationErrors('transactions.0.amount: Invalid amount')
    expect(errors).toEqual([{ row: 2, field: 'amount', value: '', message: 'Invalid amount' }])
  })

  it('parses N.field format', () => {
    const errors = parseValidationErrors('3.description: Description is required')
    expect(errors).toEqual([
      { row: 5, field: 'description', value: '', message: 'Description is required' },
    ])
  })

  it('parses transactions[N].field format', () => {
    const errors = parseValidationErrors('transactions[1].category: Category is required')
    expect(errors).toEqual([
      { row: 3, field: 'category', value: '', message: 'Category is required' },
    ])
  })

  it('handles multiple comma-separated errors', () => {
    const errors = parseValidationErrors(
      'transactions.0.amount: Invalid amount, transactions.2.description: Required'
    )
    expect(errors).toHaveLength(2)
    expect(errors[0].row).toBe(2)
    expect(errors[1].row).toBe(4)
  })

  it('falls back to generic error when pattern does not match', () => {
    const errors = parseValidationErrors('Something went wrong')
    expect(errors).toEqual([
      { row: 2, field: 'general', value: '', message: 'Something went wrong' },
    ])
  })
})

describe('checkIntraFileDuplicates', () => {
  it('returns empty array when no duplicates', () => {
    const result = checkIntraFileDuplicates([
      makeTx({ description: 'A' }),
      makeTx({ description: 'B' }),
    ])
    expect(result).toEqual([])
  })

  it('detects duplicate transactions within the file', () => {
    const result = checkIntraFileDuplicates([makeTx(), makeTx()])
    expect(result).toHaveLength(1)
    expect(result[0].row).toBe(3) // second occurrence, 0-index + 2
    expect(result[0].duplicateRows).toContain(2) // first occurrence row
    expect(result[0].duplicateRows).toContain(3)
  })

  it('detects multiple groups of duplicates', () => {
    const result = checkIntraFileDuplicates([
      makeTx({ description: 'A' }),
      makeTx({ description: 'B' }),
      makeTx({ description: 'A' }),
      makeTx({ description: 'B' }),
    ])
    expect(result).toHaveLength(2)
  })

  it('reports all occurrences after the first', () => {
    const result = checkIntraFileDuplicates([makeTx(), makeTx(), makeTx()])
    expect(result).toHaveLength(2)
    expect(result[0].row).toBe(3)
    expect(result[1].row).toBe(4)
  })
})

describe('getEntityValidationFailures', () => {
  const fullMaps = {
    valid: true,
    accountMap: new Map([['Chase Checking', 'acct-1']]),
    userMap: new Map<string, string>(),
    categoryMap: new Map([['Food', 'cat-1']]),
    typeMap: new Map([['Purchase', 'type-1']]),
  }

  it('returns empty array when all entities are valid', () => {
    const result = getEntityValidationFailures([makeTx()], fullMaps)
    expect(result).toEqual([])
  })

  it('reports missing account', () => {
    const result = getEntityValidationFailures([makeTx({ account: 'Missing Bank' })], fullMaps)
    expect(result).toHaveLength(1)
    expect(result[0].issues).toHaveLength(1)
    expect(result[0].issues[0].kind).toBe('entity')
    expect(result[0].issues[0].fields).toContain('account')
    expect(result[0].issues[0].message).toContain('Account "Missing Bank" is not defined')
  })

  it('reports missing category and type together', () => {
    const result = getEntityValidationFailures([makeTx({ category: 'Bad', type: 'Bad' })], fullMaps)
    expect(result).toHaveLength(1)
    expect(result[0].issues).toHaveLength(2)
    expect(result[0].issues.map((i: { fields: string[] }) => i.fields[0])).toContain('category')
    expect(result[0].issues.map((i: { fields: string[] }) => i.fields[0])).toContain('type')
  })

  it('reports missing user when user is specified', () => {
    const mapsWithUser = { ...fullMaps, userMap: new Map([['Known', 'u-1']]) }
    const result = getEntityValidationFailures([makeTx({ user: 'Unknown' })], mapsWithUser)
    expect(result).toHaveLength(1)
    expect(result[0].issues[0].fields).toContain('user')
    expect(result[0].issues[0].message).toContain('User "Unknown" is not defined')
  })

  it('does not report missing user when user is not specified', () => {
    const result = getEntityValidationFailures([makeTx()], fullMaps)
    expect(result).toEqual([])
  })
})

describe('filterOutEntityFailures', () => {
  const maps = {
    valid: false,
    accountMap: new Map([['Good Acct', 'a-1']]),
    userMap: new Map<string, string>(),
    categoryMap: new Map([['Food', 'c-1']]),
    typeMap: new Map([['Purchase', 't-1']]),
  }

  it('keeps transactions with all valid entities', () => {
    const result = filterOutEntityFailures([makeTx({ account: 'Good Acct' })], maps)
    expect(result).toHaveLength(1)
  })

  it('filters out transactions with missing entities', () => {
    const result = filterOutEntityFailures(
      [makeTx({ account: 'Good Acct' }), makeTx({ account: 'Bad Acct' })],
      maps
    )
    expect(result).toHaveLength(1)
    expect(result[0].account).toBe('Good Acct')
  })
})
