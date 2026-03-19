import { describe, it, expect } from 'vitest'
import {
  sanitizeText,
  convertMMDDYYYYToISO,
  validateISODate,
  validateMMDDYYYY,
  notFutureDate,
  notFutureDateISO,
  reasonableDate,
  reasonableDateISO,
  isValidAmount,
  reasonableAmount,
} from '@/lib/validation/sanitizers'

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

describe('convertMMDDYYYYToISO', () => {
  it('converts valid date correctly', () => {
    expect(convertMMDDYYYYToISO('01/15/2024')).toBe('2024-01-15')
  })

  it('converts last day of year', () => {
    expect(convertMMDDYYYYToISO('12/31/2023')).toBe('2023-12-31')
  })

  it('returns empty string for invalid input', () => {
    expect(convertMMDDYYYYToISO('not-a-date')).toBe('')
  })
})

describe('validateISODate', () => {
  it('returns true for valid ISO date', () => {
    expect(validateISODate('2024-01-15')).toBe(true)
  })

  it('returns false for wrong format', () => {
    expect(validateISODate('01/15/2024')).toBe(false)
    expect(validateISODate('2024/01/15')).toBe(false)
    expect(validateISODate('2024-1-5')).toBe(false)
  })

  it('returns false for invalid calendar date', () => {
    expect(validateISODate('2024-02-30')).toBe(false)
    expect(validateISODate('2024-13-01')).toBe(false)
  })

  it('returns true for leap year date', () => {
    expect(validateISODate('2024-02-29')).toBe(true)
  })

  it('returns false for non-leap year Feb 29', () => {
    expect(validateISODate('2023-02-29')).toBe(false)
  })
})

describe('validateMMDDYYYY', () => {
  it('returns true for valid date', () => {
    expect(validateMMDDYYYY('01/15/2024')).toBe(true)
  })

  it('returns false for invalid month', () => {
    expect(validateMMDDYYYY('13/01/2024')).toBe(false)
    expect(validateMMDDYYYY('00/01/2024')).toBe(false)
  })

  it('returns false for invalid day', () => {
    expect(validateMMDDYYYY('01/32/2024')).toBe(false)
    expect(validateMMDDYYYY('02/30/2024')).toBe(false)
  })

  it('returns false for year before 1900', () => {
    expect(validateMMDDYYYY('01/01/1899')).toBe(false)
  })

  it('returns false for wrong delimiter', () => {
    expect(validateMMDDYYYY('01-15-2024')).toBe(false)
  })

  it('returns false for non-numeric parts', () => {
    expect(validateMMDDYYYY('ab/cd/efgh')).toBe(false)
  })
})

describe('notFutureDate', () => {
  it('returns true for today', () => {
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const yyyy = today.getFullYear()
    expect(notFutureDate(`${mm}/${dd}/${yyyy}`)).toBe(true)
  })

  it('returns false for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')
    const yyyy = tomorrow.getFullYear()
    expect(notFutureDate(`${mm}/${dd}/${yyyy}`)).toBe(false)
  })

  it('returns true for past date', () => {
    expect(notFutureDate('01/01/2020')).toBe(true)
  })
})

describe('notFutureDateISO', () => {
  it('returns true for today ISO', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(notFutureDateISO(today)).toBe(true)
  })

  it('returns false for future ISO date', () => {
    expect(notFutureDateISO('2099-12-31')).toBe(false)
  })

  it('returns true for past ISO date', () => {
    expect(notFutureDateISO('2020-06-15')).toBe(true)
  })
})

describe('reasonableDate', () => {
  it('returns true for date after 1900', () => {
    expect(reasonableDate('01/01/1900')).toBe(true)
    expect(reasonableDate('06/15/2000')).toBe(true)
  })

  it('returns false for date in 1899', () => {
    expect(reasonableDate('12/31/1899')).toBe(false)
  })
})

describe('reasonableDateISO', () => {
  it('returns true for 1900 and after', () => {
    expect(reasonableDateISO('1900-01-01')).toBe(true)
    expect(reasonableDateISO('2024-06-15')).toBe(true)
  })

  it('returns false for pre-1900', () => {
    expect(reasonableDateISO('1899-12-31')).toBe(false)
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
