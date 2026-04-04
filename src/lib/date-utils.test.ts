import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  todayLocal,
  todayUTC,
  monthStartISO,
  monthEndISO,
  yearStartISO,
  yearEndISO,
  quarterStartISO,
  quarterEndISO,
  nMonthsAgoISO,
  getDateRange,
  displayDate,
  displayDateLong,
  displayTimestamp,
  displayDateTimeLocal,
  displayDateFull,
  monthName,
  isValidDateISO,
  isValidDateMDY,
  mdyToISO,
  isoToMDY,
  isNotFutureDate,
  isReasonableDate,
  currentYear,
  currentMonth,
  currentQuarter,
  prismaDateToISO,
  isoToPrismaDate,
  dateToISOLocal,
  isoToLocalDate,
  parseInstitutionDate,
} from '@/lib/date-utils'

afterEach(() => {
  vi.useRealTimers()
})

// ── String construction ─────────────────────────────────────

describe('todayLocal', () => {
  it('returns YYYY-MM-DD for the current local date', () => {
    vi.setSystemTime(new Date(2024, 2, 15, 10, 0, 0)) // Mar 15, 2024 local
    expect(todayLocal()).toBe('2024-03-15')
  })

  it('zero-pads single-digit month and day', () => {
    vi.setSystemTime(new Date(2024, 0, 5)) // Jan 5, 2024
    expect(todayLocal()).toBe('2024-01-05')
  })
})

describe('todayUTC', () => {
  it('returns YYYY-MM-DD for the current UTC date', () => {
    vi.setSystemTime(new Date('2024-07-04T12:00:00.000Z'))
    expect(todayUTC()).toBe('2024-07-04')
  })
})

describe('monthStartISO', () => {
  it('returns first day of the month', () => {
    expect(monthStartISO(2024, 1)).toBe('2024-01-01')
    expect(monthStartISO(2024, 12)).toBe('2024-12-01')
  })

  it('zero-pads single-digit months', () => {
    expect(monthStartISO(2024, 3)).toBe('2024-03-01')
  })
})

describe('monthEndISO', () => {
  it('returns last day of January', () => {
    expect(monthEndISO(2024, 1)).toBe('2024-01-31')
  })

  it('handles February in a leap year', () => {
    expect(monthEndISO(2024, 2)).toBe('2024-02-29')
  })

  it('handles February in a non-leap year', () => {
    expect(monthEndISO(2023, 2)).toBe('2023-02-28')
  })

  it('returns last day of April (30-day month)', () => {
    expect(monthEndISO(2024, 4)).toBe('2024-04-30')
  })

  it('returns last day of December', () => {
    expect(monthEndISO(2024, 12)).toBe('2024-12-31')
  })
})

describe('yearStartISO / yearEndISO', () => {
  it('returns year boundaries', () => {
    expect(yearStartISO(2024)).toBe('2024-01-01')
    expect(yearEndISO(2024)).toBe('2024-12-31')
  })
})

describe('quarterStartISO / quarterEndISO', () => {
  it('returns Q1 boundaries', () => {
    expect(quarterStartISO(2024, 1)).toBe('2024-01-01')
    expect(quarterEndISO(2024, 1)).toBe('2024-03-31')
  })

  it('returns Q2 boundaries', () => {
    expect(quarterStartISO(2024, 2)).toBe('2024-04-01')
    expect(quarterEndISO(2024, 2)).toBe('2024-06-30')
  })

  it('returns Q3 boundaries', () => {
    expect(quarterStartISO(2024, 3)).toBe('2024-07-01')
    expect(quarterEndISO(2024, 3)).toBe('2024-09-30')
  })

  it('returns Q4 boundaries', () => {
    expect(quarterStartISO(2024, 4)).toBe('2024-10-01')
    expect(quarterEndISO(2024, 4)).toBe('2024-12-31')
  })
})

describe('nMonthsAgoISO', () => {
  it('returns a date 3 months ago', () => {
    vi.setSystemTime(new Date(2024, 5, 15)) // Jun 15, 2024
    expect(nMonthsAgoISO(3)).toBe('2024-03-15')
  })

  it('handles year boundaries', () => {
    vi.setSystemTime(new Date(2024, 1, 15)) // Feb 15, 2024
    expect(nMonthsAgoISO(3)).toBe('2023-11-15')
  })
})

// ── Date range ──────────────────────────────────────────────

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
    const result = getDateRange('month', 2024, 3)
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
    expect(getDateRange('month', 2024)).toEqual({ startDate: '', endDate: '' })
  })

  it('returns empty strings for "quarter" without quarter param', () => {
    expect(getDateRange('quarter', 2024)).toEqual({ startDate: '', endDate: '' })
  })
})

// ── Display formatting ──────────────────────────────────────

describe('displayDate', () => {
  it('formats YYYY-MM-DD as short date', () => {
    expect(displayDate('2024-01-15')).toBe('Jan 15, 2024')
  })

  it('formats a full ISO timestamp', () => {
    expect(displayDate('2024-06-01T14:30:00')).toBe('Jun 1, 2024')
  })

  it('formats December 25', () => {
    expect(displayDate('2024-12-25')).toBe('Dec 25, 2024')
  })
})

describe('displayDateLong', () => {
  it('formats YYYY-MM-DD as long date', () => {
    expect(displayDateLong('2024-01-15')).toBe('January 15, 2024')
  })

  it('formats July 4', () => {
    expect(displayDateLong('2024-07-04')).toBe('July 4, 2024')
  })
})

describe('displayTimestamp', () => {
  it('formats a full ISO timestamp in local timezone', () => {
    const input = '2024-06-15T12:00:00.000Z'
    const result = displayTimestamp(input)
    // Cross-check against the runtime's own local-TZ interpretation
    const expected = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(input))
    expect(result).toBe(expected)
  })
})

describe('displayDateTimeLocal', () => {
  it('formats a full ISO timestamp with date and time in local timezone', () => {
    const input = '2024-06-15T15:45:00.000Z'
    const result = displayDateTimeLocal(input)
    const expected = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(input))
    expect(result).toBe(expected)
  })

  it('uses 12-hour format with AM/PM', () => {
    const result = displayDateTimeLocal('2024-06-15T08:30:00.000Z')
    expect(result).toMatch(/AM|PM/)
  })
})

describe('displayDateFull', () => {
  it('formats as full date with weekday and ordinal', () => {
    // Jan 15, 2024 is a Monday
    expect(displayDateFull(2024, 1, 15)).toBe('Monday, January 15th, 2024')
  })

  it('handles July 4, 2024 (Thursday)', () => {
    expect(displayDateFull(2024, 7, 4)).toBe('Thursday, July 4th, 2024')
  })

  it('uses correct ordinal suffixes', () => {
    expect(displayDateFull(2026, 1, 1)).toBe('Thursday, January 1st, 2026')
    expect(displayDateFull(2026, 1, 2)).toBe('Friday, January 2nd, 2026')
    expect(displayDateFull(2026, 1, 3)).toBe('Saturday, January 3rd, 2026')
    expect(displayDateFull(2026, 1, 11)).toBe('Sunday, January 11th, 2026')
    expect(displayDateFull(2026, 1, 21)).toBe('Wednesday, January 21st, 2026')
    expect(displayDateFull(2026, 1, 22)).toBe('Thursday, January 22nd, 2026')
    expect(displayDateFull(2026, 1, 23)).toBe('Friday, January 23rd, 2026')
    expect(displayDateFull(2026, 1, 31)).toBe('Saturday, January 31st, 2026')
  })
})

describe('monthName', () => {
  it('returns January for month 1', () => {
    expect(monthName(1)).toBe('January')
  })

  it('returns December for month 12', () => {
    expect(monthName(12)).toBe('December')
  })

  it('returns June for month 6', () => {
    expect(monthName(6)).toBe('June')
  })
})

// ── Validation ──────────────────────────────────────────────

describe('isValidDateISO', () => {
  it('returns true for valid ISO date', () => {
    expect(isValidDateISO('2024-01-15')).toBe(true)
  })

  it('returns false for wrong format', () => {
    expect(isValidDateISO('01/15/2024')).toBe(false)
    expect(isValidDateISO('2024/01/15')).toBe(false)
    expect(isValidDateISO('2024-1-5')).toBe(false)
    expect(isValidDateISO('not-a-date')).toBe(false)
  })

  it('returns false for invalid calendar date', () => {
    expect(isValidDateISO('2024-02-30')).toBe(false)
    expect(isValidDateISO('2024-13-01')).toBe(false)
  })

  it('returns true for leap year date', () => {
    expect(isValidDateISO('2024-02-29')).toBe(true)
  })

  it('returns false for non-leap year Feb 29', () => {
    expect(isValidDateISO('2023-02-29')).toBe(false)
  })

  it('returns false for ISO datetime (only accepts date-only)', () => {
    expect(isValidDateISO('2024-01-15T12:00:00')).toBe(false)
  })
})

describe('isValidDateMDY', () => {
  it('returns true for valid date', () => {
    expect(isValidDateMDY('01/15/2024')).toBe(true)
  })

  it('returns true for single-digit month and day', () => {
    expect(isValidDateMDY('3/31/2026')).toBe(true)
    expect(isValidDateMDY('1/5/2024')).toBe(true)
  })

  it('returns false for invalid month', () => {
    expect(isValidDateMDY('13/01/2024')).toBe(false)
    expect(isValidDateMDY('00/01/2024')).toBe(false)
  })

  it('returns false for invalid day', () => {
    expect(isValidDateMDY('01/32/2024')).toBe(false)
    expect(isValidDateMDY('02/30/2024')).toBe(false)
  })

  it('returns false for year before 1900', () => {
    expect(isValidDateMDY('01/01/1899')).toBe(false)
  })

  it('returns false for wrong delimiter', () => {
    expect(isValidDateMDY('01-15-2024')).toBe(false)
  })

  it('returns false for non-numeric parts', () => {
    expect(isValidDateMDY('ab/cd/efgh')).toBe(false)
  })

  it('returns false for YYYY-MM-DD format', () => {
    expect(isValidDateMDY('2024-01-15')).toBe(false)
  })
})

describe('mdyToISO', () => {
  it('converts valid date correctly', () => {
    expect(mdyToISO('01/15/2024')).toBe('2024-01-15')
  })

  it('converts last day of year', () => {
    expect(mdyToISO('12/31/2023')).toBe('2023-12-31')
  })

  it('returns empty string for invalid input', () => {
    expect(mdyToISO('not-a-date')).toBe('')
  })

  it('returns empty string for invalid calendar date', () => {
    expect(mdyToISO('02/30/2024')).toBe('')
  })

  it('converts single-digit month and day to zero-padded ISO', () => {
    expect(mdyToISO('3/31/2026')).toBe('2026-03-31')
    expect(mdyToISO('1/5/2024')).toBe('2024-01-05')
  })
})

describe('isoToMDY', () => {
  it('converts valid ISO date to MDY', () => {
    expect(isoToMDY('2024-01-15')).toBe('01/15/2024')
  })

  it('converts last day of year', () => {
    expect(isoToMDY('2023-12-31')).toBe('12/31/2023')
  })

  it('preserves zero-padding', () => {
    expect(isoToMDY('2024-03-05')).toBe('03/05/2024')
  })

  it('returns empty string for invalid input', () => {
    expect(isoToMDY('not-a-date')).toBe('')
    expect(isoToMDY('01/15/2024')).toBe('')
  })
})

describe('isNotFutureDate', () => {
  it('returns true for today', () => {
    vi.setSystemTime(new Date(2024, 5, 15)) // Jun 15, 2024
    expect(isNotFutureDate('2024-06-15')).toBe(true)
  })

  it('returns false for tomorrow', () => {
    vi.setSystemTime(new Date(2024, 5, 15))
    expect(isNotFutureDate('2024-06-16')).toBe(false)
  })

  it('returns true for past date', () => {
    vi.setSystemTime(new Date(2024, 5, 15))
    expect(isNotFutureDate('2020-01-01')).toBe(true)
  })

  it('returns false for far future', () => {
    expect(isNotFutureDate('2099-12-31')).toBe(false)
  })
})

describe('isReasonableDate', () => {
  it('returns true for 1900 and after', () => {
    expect(isReasonableDate('1900-01-01')).toBe(true)
    expect(isReasonableDate('2024-06-15')).toBe(true)
  })

  it('returns false for pre-1900', () => {
    expect(isReasonableDate('1899-12-31')).toBe(false)
  })
})

// ── Accessors ───────────────────────────────────────────────

describe('currentYear', () => {
  it('returns the current year', () => {
    expect(currentYear()).toBe(new Date().getFullYear())
  })
})

describe('currentMonth', () => {
  it('returns current month as 1-indexed value', () => {
    expect(currentMonth()).toBe(new Date().getMonth() + 1)
  })
})

describe('currentQuarter', () => {
  it('returns the current quarter', () => {
    const month = new Date().getMonth() + 1
    expect(currentQuarter()).toBe(Math.ceil(month / 3))
  })
})

// ── Prisma boundary ─────────────────────────────────────────

describe('prismaDateToISO', () => {
  it('converts a UTC Date to YYYY-MM-DD', () => {
    const date = new Date('2024-01-15T00:00:00.000Z')
    expect(prismaDateToISO(date)).toBe('2024-01-15')
  })

  it('handles dates with non-zero time component', () => {
    const date = new Date('2024-03-05T18:30:00.000Z')
    expect(prismaDateToISO(date)).toBe('2024-03-05')
  })

  it('zero-pads single-digit month and day', () => {
    const date = new Date('2024-02-03T00:00:00.000Z')
    expect(prismaDateToISO(date)).toBe('2024-02-03')
  })
})

describe('isoToPrismaDate', () => {
  it('converts YYYY-MM-DD to UTC midnight Date', () => {
    const result = isoToPrismaDate('2024-01-15')
    expect(result.toISOString()).toBe('2024-01-15T00:00:00.000Z')
  })

  it('produces correct year, month, day', () => {
    const result = isoToPrismaDate('2024-12-25')
    expect(result.getUTCFullYear()).toBe(2024)
    expect(result.getUTCMonth()).toBe(11) // 0-indexed
    expect(result.getUTCDate()).toBe(25)
  })
})

// ── Date picker boundary ────────────────────────────────────

describe('dateToISOLocal', () => {
  it('converts a local Date to YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15) // Jan 15, 2024 local
    expect(dateToISOLocal(date)).toBe('2024-01-15')
  })

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2024, 2, 5) // Mar 5, 2024
    expect(dateToISOLocal(date)).toBe('2024-03-05')
  })
})

describe('isoToLocalDate', () => {
  it('creates a local Date from YYYY-MM-DD', () => {
    const date = isoToLocalDate('2024-03-15')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(2) // 0-indexed
    expect(date.getDate()).toBe(15)
  })
})

// ── CSV date parsing ────────────────────────────────────────

describe('parseInstitutionDate', () => {
  it('parses ISO format correctly', () => {
    const result = parseInstitutionDate('2024-01-15', 'iso')
    expect(result).not.toBeNull()
    expect(result!.getUTCFullYear()).toBe(2024)
    expect(result!.getUTCMonth()).toBe(0) // January
    expect(result!.getUTCDate()).toBe(15)
    expect(result!.getUTCHours()).toBe(12) // noon anchor
  })

  it('parses MDY format correctly', () => {
    const result = parseInstitutionDate('01/15/2024', 'mdy')
    expect(result).not.toBeNull()
    expect(result!.getUTCFullYear()).toBe(2024)
    expect(result!.getUTCMonth()).toBe(0)
    expect(result!.getUTCDate()).toBe(15)
    expect(result!.getUTCHours()).toBe(12)
  })

  it('returns null for empty input', () => {
    expect(parseInstitutionDate('', 'iso')).toBeNull()
    expect(parseInstitutionDate('  ', 'mdy')).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(parseInstitutionDate('not-a-date', 'iso')).toBeNull()
    expect(parseInstitutionDate('13/32/2024', 'mdy')).toBeNull()
  })

  it('returns null for invalid calendar date', () => {
    expect(parseInstitutionDate('2024-02-30', 'iso')).toBeNull()
    expect(parseInstitutionDate('02/30/2024', 'mdy')).toBeNull()
  })

  it('trims whitespace', () => {
    const result = parseInstitutionDate('  2024-01-15  ', 'iso')
    expect(result).not.toBeNull()
    expect(result!.getUTCDate()).toBe(15)
  })
})
