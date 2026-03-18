// Known MIME types that browsers/OS report for CSV files
const ACCEPTED_CSV_MIME_TYPES = new Set([
  'text/csv', // Chrome/Firefox on macOS/Linux (spec-correct)
  'text/plain', // Safari on macOS, many Linux distros
  'application/vnd.ms-excel', // Windows Explorer
  'application/csv', // Rare but observed
])

/**
 * Check whether a File is a valid CSV based on extension and MIME type.
 * Extension `.csv` is required. MIME must be in the whitelist OR empty
 * (some browser/OS combos report an empty string for CSV).
 */
export function isValidCsvFile(file: File): boolean {
  const hasCSVExtension = file.name.toLowerCase().endsWith('.csv')
  if (!hasCSVExtension) return false

  const mime = file.type
  return mime === '' || ACCEPTED_CSV_MIME_TYPES.has(mime)
}

/**
 * Sanitize a string value so it cannot be interpreted as a spreadsheet
 * formula when written to an Excel cell. Prefixes dangerous leading
 * characters with a single-quote text escape.
 */
export function sanitizeCellValue(value: string): string {
  if (value.length === 0) return value
  const first = value[0]
  if (first === '=' || first === '+' || first === '@' || first === '\t' || first === '\r') {
    return `'${value}`
  }
  // Leading minus is only dangerous when followed by a non-digit (e.g. `-SUM()`).
  // Numeric negatives like `-85.79` are safe and must stay as-is.
  if (first === '-' && (value.length === 1 || !/^\d/.test(value[1]))) {
    return `'${value}`
  }
  return value
}
