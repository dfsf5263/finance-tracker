// ── String-first date utilities ─────────────────────────────
//
// All date-only values (transaction dates, post dates, date range boundaries)
// are represented as YYYY-MM-DD strings throughout the stack.
// Date objects are used only transiently for arithmetic (via Date.UTC),
// never exposed as an interchange type.

// ── Padding helper ──────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`
  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

// ── String construction ─────────────────────────────────────

/** YYYY-MM-DD for today in the caller's local timezone (client + validation) */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD for today in UTC (server-side) */
export function todayUTC(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** First day of the given month. Month is 1-indexed. */
export function monthStartISO(year: number, month: number): string {
  return `${year}-${pad(month)}-01`
}

/** Last day of the given month. Month is 1-indexed. */
export function monthEndISO(year: number, month: number): string {
  // Day 0 of *next* month = last day of *this* month
  const d = new Date(Date.UTC(year, month, 0))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** First day of the given year. */
export function yearStartISO(year: number): string {
  return `${year}-01-01`
}

/** Last day of the given year. */
export function yearEndISO(year: number): string {
  return `${year}-12-31`
}

/** First day of the given quarter (1-4). */
export function quarterStartISO(year: number, quarter: number): string {
  const month = (quarter - 1) * 3 + 1
  return `${year}-${pad(month)}-01`
}

/** Last day of the given quarter (1-4). */
export function quarterEndISO(year: number, quarter: number): string {
  const lastMonth = quarter * 3
  return monthEndISO(year, lastMonth)
}

/** YYYY-MM-DD for N months ago from today (local). */
export function nMonthsAgoISO(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ── Date range ──────────────────────────────────────────────

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
    return { startDate: yearStartISO(year), endDate: yearEndISO(year) }
  }
  if (period === 'month' && month) {
    return { startDate: monthStartISO(year, month), endDate: monthEndISO(year, month) }
  }
  if (period === 'quarter' && quarter) {
    return { startDate: quarterStartISO(year, quarter), endDate: quarterEndISO(year, quarter) }
  }
  return { startDate: '', endDate: '' }
}

// ── Display formatting (Intl wrappers) ──────────────────────

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Like longDateFormatter but uses the viewer's local timezone (for full timestamps). */
const localLongDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const longMonthOnlyFormatter = new Intl.DateTimeFormat('en-US', { month: 'long' })

const longMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long' })

/** Format YYYY-MM-DD or ISO timestamp → "Jan 15, 2024" */
export function displayDate(isoDate: string): string {
  const d = isoToUTCDate(isoDate)
  return shortDateFormatter.format(d)
}

/** Format YYYY-MM-DD or ISO timestamp → "January 15, 2024" */
export function displayDateLong(isoDate: string): string {
  const d = isoToUTCDate(isoDate)
  return longDateFormatter.format(d)
}

/**
 * Format a full timestamp string → "January 15, 2024" in the viewer's local timezone.
 * For non-date-only values like createdAt.
 */
export function displayTimestamp(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  return localLongDateFormatter.format(d)
}

/** Date + time in the viewer's local timezone (for expiration timestamps). */
const localDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/**
 * Format a full timestamp string → "March 27, 2026 at 3:45 PM" in the viewer's local timezone.
 * For time-sensitive values like invitation expiresAt.
 */
export function displayDateTimeLocal(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  return localDateTimeFormatter.format(d)
}

/**
 * Format year/month/day → "Tuesday, January 15th, 2024"
 * Matches react-day-picker's ordinal aria-label format.
 */
export function displayDateFull(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day)
  const wd = weekdayFormatter.format(d)
  const mo = longMonthOnlyFormatter.format(d)
  return `${wd}, ${mo} ${ordinal(day)}, ${year}`
}

/** Month name from 1-indexed month number → "January" */
export function monthName(month: number): string {
  const d = new Date(2024, month - 1, 1)
  return longMonthFormatter.format(d)
}

// ── Validation (string-based) ───────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MDY_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** Validate a YYYY-MM-DD string: correct format AND valid calendar date. */
export function isValidDateISO(isoDate: string): boolean {
  if (!ISO_DATE_RE.test(isoDate)) return false
  const [year, month, day] = isoDate.split('-').map(Number)
  // Round-trip through Date.UTC to verify calendar validity
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

/** Validate an MM/DD/YYYY string: correct format AND valid calendar date. */
export function isValidDateMDY(dateStr: string): boolean {
  const match = MDY_DATE_RE.exec(dateStr)
  if (!match) return false
  const month = parseInt(match[1], 10)
  const day = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)
  if (year < 1900 || year > 9999) return false
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

/**
 * Convert MM/DD/YYYY → YYYY-MM-DD without timezone bugs.
 * Pure string transform — no Date object in the output path.
 */
export function mdyToISO(dateStr: string): string {
  const match = MDY_DATE_RE.exec(dateStr)
  if (!match) return ''
  const month = parseInt(match[1], 10)
  const day = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)
  // Validate that the date is real
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return ''
  }
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Convert YYYY-MM-DD → MM/DD/YYYY without timezone bugs.
 * Pure string transform — inverse of mdyToISO.
 */
export function isoToMDY(isoDate: string): string {
  if (!ISO_DATE_RE.test(isoDate)) return ''
  const [yearStr, monthStr, dayStr] = isoDate.split('-')
  return `${monthStr}/${dayStr}/${yearStr}`
}

/**
 * Returns true if the ISO date string is not in the future (compared to local today).
 * String comparison — no mixed timezone semantics.
 */
export function isNotFutureDate(isoDate: string): boolean {
  return isoDate <= todayLocal()
}

/**
 * Returns true if the ISO date string is >= 1900-01-01.
 * Pure string comparison.
 */
export function isReasonableDate(isoDate: string): boolean {
  return isoDate >= '1900-01-01'
}

// ── Accessors ───────────────────────────────────────────────

export function currentYear(): number {
  return new Date().getFullYear()
}

/** 1-indexed current month (January = 1). */
export function currentMonth(): number {
  return new Date().getMonth() + 1
}

export function currentQuarter(): number {
  return Math.ceil(currentMonth() / 3)
}

// ── Prisma boundary helpers ─────────────────────────────────

/**
 * Convert a Prisma DateTime to YYYY-MM-DD string.
 * Uses UTC getters since Prisma stores dates in UTC.
 */
export function prismaDateToISO(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/**
 * Convert a YYYY-MM-DD string to a Date for Prisma writes.
 * Anchored at UTC midnight.
 */
export function isoToPrismaDate(isoDate: string): Date {
  return new Date(isoDate + 'T00:00:00.000Z')
}

// ── Date ↔ object boundary (for date-picker only) ──────────

/**
 * Convert a Date from a calendar widget to YYYY-MM-DD string.
 * Uses local-time getters since the calendar operates in the user's timezone.
 */
export function dateToISOLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Convert a YYYY-MM-DD string to a local Date for a calendar widget.
 * Creates a local-midnight Date so the calendar shows the correct day.
 */
export function isoToLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// ── CSV date parsing ────────────────────────────────────────

/**
 * Parse a date string in either ISO or MDY format from a CSV file.
 * Returns a Date anchored at noon UTC to prevent Excel serial-date day-shift.
 */
export function parseInstitutionDate(value: string, dateFormat: 'iso' | 'mdy'): Date | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()

  let year: number
  let month: number
  let day: number

  if (dateFormat === 'iso') {
    const match = ISO_DATE_RE.exec(trimmed)
    if (!match) return null
    ;[year, month, day] = trimmed.split('-').map(Number)
  } else {
    const match = MDY_DATE_RE.exec(trimmed)
    if (!match) return null
    month = parseInt(match[1], 10)
    day = parseInt(match[2], 10)
    year = parseInt(match[3], 10)
  }

  // Validate calendar date via UTC round-trip
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null
  }

  // Anchor at noon UTC so Excel serial-date conversion never shifts the calendar day
  return new Date(Date.UTC(year, month - 1, day, 12))
}

// ── Internal helpers ────────────────────────────────────────

/** Parse a YYYY-MM-DD (or YYYY-MM-DDTHH:mm:ss) string to a UTC Date for formatting. */
function isoToUTCDate(isoDate: string): Date {
  if (ISO_DATE_RE.test(isoDate)) {
    const [year, month, day] = isoDate.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }
  return new Date(isoDate)
}
