import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  format,
  parseISO,
  isValid,
  parse,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  getYear,
  getMonth,
} from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Date utility functions using date-fns
// NEW: Standardized ISO date functions
export function parseISODate(isoString: string): Date {
  // Parse ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  return parseISO(isoString)
}

export function toISODateString(date: Date): string {
  // Convert Date to ISO date string (YYYY-MM-DD)
  return format(date, 'yyyy-MM-dd')
}

export function formatDateFromISO(isoString: string): string {
  // Format ISO date string for display (MMM d, yyyy)
  // Handle date-only strings without timezone conversion
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    // Date-only format (YYYY-MM-DD) - parse directly without timezone
    return format(parse(isoString, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')
  }
  // Full ISO timestamp - use parseISO for timezone handling
  return format(parseISO(isoString), 'MMM d, yyyy')
}

export function formatDateOnly(dateString: string): string {
  // Format date-only string (YYYY-MM-DD) for display without timezone issues
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return format(parse(dateString, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')
  }
  // Fallback to regular ISO parsing for backwards compatibility
  return format(parseISO(dateString), 'MMM d, yyyy')
}

export function isValidISODate(isoString: string): boolean {
  // Validate ISO date string format
  try {
    const date = parseISO(isoString)
    return isValid(date) && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(isoString)
  } catch {
    return false
  }
}

export function isValidMonthDayYearDate(dateString: string): boolean {
  try {
    const date = parse(dateString, 'MM/dd/yyyy', new Date())
    return isValid(date)
  } catch {
    return false
  }
}

export function parseMonthDayYearDate(dateString: string): Date {
  return parse(dateString, 'MM/dd/yyyy', new Date())
}

export function getDateRange(
  period: 'all' | 'year' | 'month' | 'quarter',
  year: number,
  month?: number,
  quarter?: number
): { startDate: string; endDate: string } {
  if (period === 'all') {
    return { startDate: '', endDate: '' }
  }

  if (period === 'year') {
    const yearStart = startOfYear(new Date(year, 0, 1))
    const yearEnd = endOfYear(new Date(year, 0, 1))
    return {
      startDate: toISODateString(yearStart),
      endDate: toISODateString(yearEnd),
    }
  }

  if (period === 'month' && month) {
    const monthStart = startOfMonth(new Date(year, month - 1, 1))
    const monthEnd = endOfMonth(new Date(year, month - 1, 1))
    return {
      startDate: toISODateString(monthStart),
      endDate: toISODateString(monthEnd),
    }
  }

  if (period === 'quarter' && quarter) {
    const quarterStartMonth = (quarter - 1) * 3
    const quarterStart = startOfMonth(new Date(year, quarterStartMonth, 1))
    const quarterEnd = endOfMonth(new Date(year, quarterStartMonth + 2, 1))
    return {
      startDate: toISODateString(quarterStart),
      endDate: toISODateString(quarterEnd),
    }
  }

  return { startDate: '', endDate: '' }
}

export function getMonthName(monthNumber: number): string {
  const date = new Date(2000, monthNumber - 1, 1) // Use year 2000 as arbitrary non-leap year
  return format(date, 'MMMM')
}

export function getCurrentYear(): number {
  return getYear(new Date())
}

export function getCurrentMonth(): number {
  return getMonth(new Date()) + 1 // date-fns getMonth returns 0-indexed, we want 1-indexed
}

export function getCurrentQuarter(): number {
  const month = getMonth(new Date()) + 1 // 1-indexed month
  return Math.ceil(month / 3)
}
