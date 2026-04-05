import { describe, it, expect } from 'vitest'
import {
  householdCreateSchema,
  paginationSchema,
  transactionCreateSchema,
  validateRequestBody,
  validateQueryParams,
} from '@/lib/validation'

describe('householdCreateSchema', () => {
  it('passes with valid name only', () => {
    const result = householdCreateSchema.safeParse({ name: 'My Household' })
    expect(result.success).toBe(true)
  })

  it('passes with name and numeric annualBudget', () => {
    const result = householdCreateSchema.safeParse({ name: 'My Household', annualBudget: 60000 })
    expect(result.success).toBe(true)
  })

  it('passes with name and string annualBudget', () => {
    const result = householdCreateSchema.safeParse({ name: 'My Household', annualBudget: '60000' })
    expect(result.success).toBe(true)
  })

  it('passes with name and undefined annualBudget', () => {
    const result = householdCreateSchema.safeParse({
      name: 'My Household',
      annualBudget: undefined,
    })
    expect(result.success).toBe(true)
  })

  it('passes with name and null annualBudget', () => {
    const result = householdCreateSchema.safeParse({
      name: 'My Household',
      annualBudget: null,
    })
    expect(result.success).toBe(true)
  })

  it('fails when name is missing', () => {
    const result = householdCreateSchema.safeParse({ annualBudget: 60000 })
    expect(result.success).toBe(false)
  })

  it('fails when name is empty string', () => {
    const result = householdCreateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Household name is required')
    }
  })
})

describe('paginationSchema', () => {
  it('passes with valid page and limit', () => {
    const result = paginationSchema.safeParse({ page: '1', limit: '10' })
    expect(result.success).toBe(true)
  })

  it('passes with limit=1000 (upper boundary)', () => {
    const result = paginationSchema.safeParse({ limit: '1000' })
    expect(result.success).toBe(true)
  })

  it('passes with no params (all optional)', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('fails when page=0', () => {
    const result = paginationSchema.safeParse({ page: '0' })
    expect(result.success).toBe(false)
  })

  it('fails when limit=1001', () => {
    const result = paginationSchema.safeParse({ limit: '1001' })
    expect(result.success).toBe(false)
  })

  it('fails when page is non-numeric string', () => {
    const result = paginationSchema.safeParse({ page: 'abc' })
    expect(result.success).toBe(false)
  })
})

describe('transactionCreateSchema', () => {
  const validBase = {
    accountId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
    userId: null,
    transactionDate: '2024-01-15',
    postDate: '2024-01-16',
    description: 'Coffee Shop',
    categoryId: 'b2c3d4e5-f6a7-4901-bcde-f12345678901',
    typeId: 'c3d4e5f6-a7b8-4012-9def-123456789012',
    amount: '12.50',
    householdId: 'd4e5f6a7-b8c9-4123-8efa-234567890123',
  }

  it('passes with all valid fields', () => {
    const result = transactionCreateSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it('fails when accountId is not a UUID', () => {
    const result = transactionCreateSchema.safeParse({ ...validBase, accountId: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Invalid account ID format'))).toBe(true)
    }
  })

  it('fails when categoryId is not a UUID', () => {
    const result = transactionCreateSchema.safeParse({ ...validBase, categoryId: 'bad-id' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Invalid category ID format'))).toBe(true)
    }
  })

  it('fails when transactionDate is invalid', () => {
    const result = transactionCreateSchema.safeParse({
      ...validBase,
      transactionDate: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('fails when amount is zero', () => {
    const result = transactionCreateSchema.safeParse({ ...validBase, amount: '0' })
    expect(result.success).toBe(false)
  })
})

describe('validateRequestBody', () => {
  it('returns success with valid data', () => {
    const result = validateRequestBody(householdCreateSchema, { name: 'Test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Test')
    }
  })

  it('returns failure with field path in error string', () => {
    const result = validateRequestBody(householdCreateSchema, { name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('name:')
      expect(result.error).toContain('Household name is required')
    }
  })
})

describe('validateQueryParams', () => {
  it('returns success with valid params', () => {
    const result = validateQueryParams(paginationSchema, { page: '1', limit: '10' })
    expect(result.success).toBe(true)
  })

  it('returns failure with field path in error string', () => {
    const result = validateQueryParams(paginationSchema, { page: '0' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('page:')
    }
  })
})
