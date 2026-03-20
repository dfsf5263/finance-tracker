import { describe, it, expect } from 'vitest'
import { formatCurrency, cn } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats a positive USD amount', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats a negative amount', () => {
    expect(formatCurrency(-50)).toBe('-$50.00')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats a round number', () => {
    expect(formatCurrency(100)).toBe('$100.00')
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes', () => {
    // tailwind-merge should keep only the last conflicting class
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('ignores falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  it('handles conditional objects', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })
})
