import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  isValidISODate,
  cn,
  parseISODate,
  toISODateString,
  formatDateFromISO,
  formatDateOnly,
  isValidMonthDayYearDate,
  parseMonthDayYearDate,
  getDateRange,
  getMonthName,
  getCurrentYear,
  getCurrentMonth,
  getCurrentQuarter,
} from '@/lib/utils'

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

describe('isValidISODate', () => {
  it('returns true for valid YYYY-MM-DD', () => {
    expect(isValidISODate('2024-01-15')).toBe(true)
  })

  it('returns true for valid ISO datetime', () => {
    expect(isValidISODate('2024-01-15T12:00:00')).toBe(true)
  })

  it('returns false for single-digit month/day (no leading zero)', () => {
    expect(isValidISODate('2024-1-5')).toBe(false)
  })

  it('returns false for non-date string', () => {
    expect(isValidISODate('not-a-date')).toBe(false)
  })

  it('returns false for MM/DD/YYYY format', () => {
    expect(isValidISODate('01/15/2024')).toBe(false)
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

describe('parseISODate', () => {
  it('parses a YYYY-MM-DD string', () => {
    const date = parseISODate('2024-03-15')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(2) // 0-indexed
    expect(date.getDate()).toBe(15)
  })

  it('parses a full ISO datetime string', () => {
    const date = parseISODate('2024-06-01T14:30:00')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getHours()).toBe(14)
  })
})

describe('toISODateString', () => {
  it('converts a Date to YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15) // Jan 15, 2024
    expect(toISODateString(date)).toBe('2024-01-15')
  })

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2024, 2, 5) // Mar 5, 2024
    expect(toISODateString(date)).toBe('2024-03-05')
  })
})

describe('formatDateFromISO', () => {
  it('formats a date-only string without timezone shift', () => {
    expect(formatDateFromISO('2024-01-15')).toBe('Jan 15, 2024')
  })

  it('formats a full ISO timestamp', () => {
    expect(formatDateFromISO('2024-06-01T14:30:00')).toBe('Jun 1, 2024')
  })
})

describe('formatDateOnly', () => {
  it('formats a YYYY-MM-DD string for display', () => {
    expect(formatDateOnly('2024-12-25')).toBe('Dec 25, 2024')
  })

  it('falls back to ISO parsing for non-date-only format', () => {
    expect(formatDateOnly('2024-07-04T00:00:00')).toBe('Jul 4, 2024')
  })
})

describe('isValidMonthDayYearDate', () => {
  it('returns true for valid MM/DD/YYYY', () => {
    expect(isValidMonthDayYearDate('01/15/2024')).toBe(true)
  })

  it('returns false for invalid date', () => {
    expect(isValidMonthDayYearDate('not-a-date')).toBe(false)
  })

  it('returns false for YYYY-MM-DD format', () => {
    expect(isValidMonthDayYearDate('2024-01-15')).toBe(false)
  })
})

describe('parseMonthDayYearDate', () => {
  it('parses MM/DD/YYYY to a Date', () => {
    const date = parseMonthDayYearDate('03/15/2024')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(15)
  })
})

describe('getDateRange', () => {
  it('returns empty strings for "all" period', () => {
    expect(getDateRange('all', 2024)).toEqual({ startDate: '', endDate: '' })
  })

  it('returns year boundaries for "year" period', () => {
    const result = getDateRange('year', 2024)
    expect(result.startDate).toBe('2024-01-01')
    expect(result.endDate).toBe('2024-12-31')
  })

  it('returns month boundaries for "month" period', () => {
    const result = getDateRange('month', 2024, 3) // March
    expect(result.startDate).toBe('2024-03-01')
    expect(result.endDate).toBe('2024-03-31')
  })

  it('returns quarter boundaries for Q1', () => {
    const result = getDateRange('quarter', 2024, undefined, 1)
    expect(result.startDate).toBe('2024-01-01')
    expect(result.endDate).toBe('2024-03-31')
  })

  it('returns quarter boundaries for Q3', () => {
    const result = getDateRange('quarter', 2024, undefined, 3)
    expect(result.startDate).toBe('2024-07-01')
    expect(result.endDate).toBe('2024-09-30')
  })

  it('returns empty strings for "month" without month param', () => {
    const result = getDateRange('month', 2024)
    expect(result).toEqual({ startDate: '', endDate: '' })
  })

  it('returns empty strings for "quarter" without quarter param', () => {
    const result = getDateRange('quarter', 2024)
    expect(result).toEqual({ startDate: '', endDate: '' })
  })
})

describe('getMonthName', () => {
  it('returns January for month 1', () => {
    expect(getMonthName(1)).toBe('January')
  })

  it('returns December for month 12', () => {
    expect(getMonthName(12)).toBe('December')
  })

  it('returns June for month 6', () => {
    expect(getMonthName(6)).toBe('June')
  })
})

describe('getCurrentYear', () => {
  it('returns the current year', () => {
    expect(getCurrentYear()).toBe(new Date().getFullYear())
  })
})

describe('getCurrentMonth', () => {
  it('returns current month as 1-indexed value', () => {
    expect(getCurrentMonth()).toBe(new Date().getMonth() + 1)
  })
})

describe('getCurrentQuarter', () => {
  it('returns the current quarter', () => {
    const month = new Date().getMonth() + 1
    const expectedQuarter = Math.ceil(month / 3)
    expect(getCurrentQuarter()).toBe(expectedQuarter)
  })
})
