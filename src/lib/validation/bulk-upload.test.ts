import { describe, it, expect } from 'vitest'
import { bulkTransactionSchema, bulkUploadRequestSchema } from '@/lib/validation/bulk-upload'

const HOUSEHOLD_ID = 'd4e5f6a7-b8c9-4123-8efa-234567890123'

const validTransaction = {
  account: 'Chase Checking',
  transactionDate: '2024-01-15',
  description: 'Coffee Shop',
  category: 'Food & Dining',
  type: 'Purchase',
  amount: '12.50',
}

describe('bulkTransactionSchema', () => {
  it('parses a valid transaction', () => {
    const result = bulkTransactionSchema.safeParse(validTransaction)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.account).toBe('Chase Checking')
      expect(result.data.amount).toBe('12.50')
      // date is transformed to ISO DateTime string
      expect(result.data.transactionDate).toContain('2024-01-15')
    }
  })

  it('trims whitespace from account', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, account: '  Chase  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.account).toBe('Chase')
  })

  it('rejects XSS in account name', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      account: '<script>alert(1)</script>',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('invalid characters'))).toBe(true)
    }
  })

  it('rejects empty account', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, account: '' })
    expect(result.success).toBe(false)
  })

  it('rejects account name over 100 characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      account: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects future transactionDate', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      transactionDate: '2099-12-31',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('future'))).toBe(true)
    }
  })

  it('rejects invalid date format for transactionDate', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      transactionDate: '01/15/2024',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('YYYY-MM-DD'))).toBe(true)
    }
  })

  it('rejects transactionDate before 1900', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      transactionDate: '1899-12-31',
    })
    expect(result.success).toBe(false)
  })

  it('sanitizes XSS from description', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      description: 'Buy <script>stuff</script>',
    })
    // sanitizeText strips <>, so description becomes "Buy scriptstuff/script"
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).not.toContain('<')
      expect(result.data.description).not.toContain('>')
    }
  })

  it('sanitizes SQL injection from description', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      description: "Coffee'; DROP TABLE transactions; --",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).not.toContain("'")
      expect(result.data.description).not.toContain(';')
    }
  })

  it('rejects category with invalid characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      category: 'Food <Dining>',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('invalid characters'))).toBe(true)
    }
  })

  it('strips $ and , from amount', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, amount: '$1,234.56' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amount).toBe('1234.56')
  })

  it('rejects non-numeric amount', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, amount: 'not-a-number' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Invalid amount'))).toBe(true)
    }
  })

  it('rejects amount over 1,000,000', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, amount: '1000001' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('1,000,000'))).toBe(true)
    }
  })

  it('accepts negative amount', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, amount: '-50.00' })
    expect(result.success).toBe(true)
  })

  it('accepts optional user field', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, user: 'Alice' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.user).toBe('Alice')
  })

  it('accepts optional memo field', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      memo: 'Note about purchase',
    })
    expect(result.success).toBe(true)
  })

  it('rejects user name over 100 characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      user: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects user name with invalid characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      user: 'User<script>',
    })
    expect(result.success).toBe(false)
  })

  it('accepts and transforms valid postDate', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      postDate: '2024-01-16',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.postDate).toContain('2024-01-16')
    }
  })

  it('rejects postDate with invalid format', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      postDate: '01/16/2024',
    })
    expect(result.success).toBe(false)
  })

  it('rejects postDate that is not a real date', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      postDate: '2024-02-30',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty description', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, description: '' })
    expect(result.success).toBe(false)
  })

  it('rejects description over 500 characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      description: 'A'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty category', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, category: '' })
    expect(result.success).toBe(false)
  })

  it('rejects category over 100 characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      category: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty type', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, type: '' })
    expect(result.success).toBe(false)
  })

  it('rejects type over 50 characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      type: 'A'.repeat(51),
    })
    expect(result.success).toBe(false)
  })

  it('rejects type with invalid characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      type: 'Type<>!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects memo over 1000 characters', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      memo: 'A'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects transactionDate that is not a real date', () => {
    const result = bulkTransactionSchema.safeParse({
      ...validTransaction,
      transactionDate: '2024-02-30',
    })
    expect(result.success).toBe(false)
  })

  it('accepts amount at boundary -1000000', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, amount: '-1000000' })
    expect(result.success).toBe(true)
  })

  it('rejects amount below -1000000', () => {
    const result = bulkTransactionSchema.safeParse({ ...validTransaction, amount: '-1000001' })
    expect(result.success).toBe(false)
  })
})

describe('bulkUploadRequestSchema', () => {
  it('parses valid request', () => {
    const result = bulkUploadRequestSchema.safeParse({
      householdId: HOUSEHOLD_ID,
      transactions: [validTransaction],
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID householdId', () => {
    const result = bulkUploadRequestSchema.safeParse({
      householdId: 'not-a-uuid',
      transactions: [validTransaction],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Invalid household ID'))).toBe(true)
    }
  })

  it('rejects empty transactions array', () => {
    const result = bulkUploadRequestSchema.safeParse({
      householdId: HOUSEHOLD_ID,
      transactions: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('At least one transaction'))).toBe(true)
    }
  })

  it('rejects more than 5000 transactions', () => {
    const transactions = Array.from({ length: 5001 }, () => validTransaction)
    const result = bulkUploadRequestSchema.safeParse({
      householdId: HOUSEHOLD_ID,
      transactions,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('5000'))).toBe(true)
    }
  })

  it('accepts exactly 1 transaction', () => {
    const result = bulkUploadRequestSchema.safeParse({
      householdId: HOUSEHOLD_ID,
      transactions: [validTransaction],
    })
    expect(result.success).toBe(true)
  })
})
