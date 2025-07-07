import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  format,
  parseISO,
  isValid,
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
export function parseLocalDate(dateString: string): Date {
  // Handle both ISO strings and date-only strings
  const dateOnly = dateString.split('T')[0]
  return parseISO(dateOnly)
}

export function formatDate(date: Date): string {
  return format(date, 'MMM d, yyyy')
}

export function formatDateForInput(date: Date): string {
  // Format for HTML date inputs (YYYY-MM-DD)
  return format(date, 'yyyy-MM-dd')
}

export function parseInputDate(dateString: string): Date {
  // Parse HTML date input values (YYYY-MM-DD)
  return parseISO(dateString)
}

export function isValidDate(dateString: string): boolean {
  try {
    const date = parseISO(dateString)
    return isValid(date)
  } catch {
    return false
  }
}

export function getDateRange(
  period: 'all' | 'year' | 'month',
  year: number,
  month?: number
): { startDate: string; endDate: string } {
  if (period === 'all') {
    return { startDate: '', endDate: '' }
  }

  if (period === 'year') {
    const yearStart = startOfYear(new Date(year, 0, 1))
    const yearEnd = endOfYear(new Date(year, 0, 1))
    return {
      startDate: formatDateForInput(yearStart),
      endDate: formatDateForInput(yearEnd),
    }
  }

  if (period === 'month' && month) {
    const monthStart = startOfMonth(new Date(year, month - 1, 1))
    const monthEnd = endOfMonth(new Date(year, month - 1, 1))
    return {
      startDate: formatDateForInput(monthStart),
      endDate: formatDateForInput(monthEnd),
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
