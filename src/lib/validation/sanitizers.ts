// Prevent XSS and SQL injection
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['";\\]/g, '') // Remove SQL/JS dangerous chars
    .replace(/\0/g, '') // Remove null bytes
    .trim()
}

// Parse MM/DD/YYYY date string to Date object
export function parseMMDDYYYY(dateStr: string): Date {
  const parts = dateStr.split('/')
  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)

  return new Date(year, month - 1, day)
}

// Validate date formats and ranges
export function validateMMDDYYYY(dateStr: string): boolean {
  const parts = dateStr.split('/')
  if (parts.length !== 3) return false

  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)

  if (isNaN(month) || isNaN(day) || isNaN(year)) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  if (year < 1900 || year > 9999) return false

  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function notFutureDate(dateStr: string): boolean {
  const date = parseMMDDYYYY(dateStr)
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of today
  return date <= today
}

export function reasonableDate(dateStr: string): boolean {
  const date = parseMMDDYYYY(dateStr)
  return date >= new Date(1900, 0, 1)
}

// Validate amounts
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount)
  return !isNaN(num) && isFinite(num)
}

export function reasonableAmount(amount: string): boolean {
  const num = parseFloat(amount)
  return Math.abs(num) <= 1000000 // Max 1 million
}
