import { describe, it, expect } from 'vitest'
import { sanitizeText, isValidAmount, reasonableAmount } from '@/lib/validation/sanitizers'

describe('sanitizeText', () => {
  it('removes HTML angle brackets', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script')
  })

  it('removes single quotes, double quotes, semicolons, backslashes', () => {
    expect(sanitizeText("'; DROP TABLE users; --")).toBe('DROP TABLE users --')
  })

  it('removes null bytes', () => {
    expect(sanitizeText('hello\0world')).toBe('helloworld')
  })

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })

  it('leaves safe characters unchanged', () => {
    expect(sanitizeText('Coffee Shop - Main St.')).toBe('Coffee Shop - Main St.')
  })

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('')
  })

  it('handles string with only dangerous chars', () => {
    expect(sanitizeText('<>\'"')).toBe('')
  })

  it('preserves leading formula characters (handled at export time)', () => {
    expect(sanitizeText('=CMD|calc')).toBe('=CMD|calc')
    expect(sanitizeText('+1+2')).toBe('+1+2')
    expect(sanitizeText('@SUM(A1)')).toBe('@SUM(A1)')
    expect(sanitizeText('-85.79')).toBe('-85.79')
  })
})

describe('isValidAmount', () => {
  it('returns true for integer string', () => {
    expect(isValidAmount('100')).toBe(true)
  })

  it('returns true for decimal string', () => {
    expect(isValidAmount('12.50')).toBe(true)
  })

  it('returns true for negative amount', () => {
    expect(isValidAmount('-50.00')).toBe(true)
  })

  it('returns false for non-numeric string', () => {
    expect(isValidAmount('abc')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidAmount('')).toBe(false)
  })

  it('returns false for Infinity', () => {
    expect(isValidAmount('Infinity')).toBe(false)
  })
})

describe('reasonableAmount', () => {
  it('returns true for amount within bounds', () => {
    expect(reasonableAmount('999999')).toBe(true)
    expect(reasonableAmount('-999999')).toBe(true)
    expect(reasonableAmount('0')).toBe(true)
  })

  it('returns true for exactly 1000000', () => {
    expect(reasonableAmount('1000000')).toBe(true)
  })

  it('returns false for amount exceeding 1,000,000', () => {
    expect(reasonableAmount('1000001')).toBe(false)
    expect(reasonableAmount('-1000001')).toBe(false)
  })
})
