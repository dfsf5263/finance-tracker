// Known MIME types that browsers/OS report for CSV files
const ACCEPTED_CSV_MIME_TYPES = new Set([
  'text/csv', // Chrome/Firefox on macOS/Linux (spec-correct)
  'text/plain', // Safari on macOS, many Linux distros
  'application/vnd.ms-excel', // Windows Explorer
  'application/csv', // Rare but observed
])

// Known MIME types that browsers/OS report for .xlsx files
const ACCEPTED_XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
 * Check whether a File is a valid Excel (.xlsx) file based on extension and MIME type.
 * Extension `.xlsx` is required. MIME must be in the whitelist OR empty
 * (some browser/OS combos report an empty string).
 */
export function isValidExcelFile(file: File): boolean {
  const hasXlsxExtension = file.name.toLowerCase().endsWith('.xlsx')
  if (!hasXlsxExtension) return false

  const mime = file.type
  return mime === '' || ACCEPTED_XLSX_MIME_TYPES.has(mime)
}

/**
 * Format a Date as MM/DD/YYYY using UTC components.
 * ExcelJS creates Date objects at UTC midnight; using local getters would
 * shift the date in timezones west of UTC.
 */
function formatDateUTC(d: Date): string {
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${month}/${day}/${year}`
}

/**
 * Parse an Excel (.xlsx) file into an array of row objects keyed by the
 * header values from the first row. Only the first worksheet is used.
 *
 * Cell value normalisation:
 * - Date objects (exceljs returns these for Date and General date cells) are
 *   formatted as "MM/DD/YYYY" so they flow through convertCSVDateToISO() unchanged.
 * - Numeric values are converted to their string representation.
 * - Null / undefined cells map to an empty string.
 * - Fully-empty rows are omitted from the result.
 */
export async function parseExcelToRows(file: File): Promise<Record<string, unknown>[]> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const headers: string[] = []
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '')
  })

  const rows: Record<string, unknown>[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header row

    const record: Record<string, unknown> = {}
    let hasValue = false

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (!header) return

      const value = cell.value

      if (value === null || value === undefined) {
        record[header] = ''
      } else if (value instanceof Date) {
        record[header] = formatDateUTC(value)
        hasValue = true
      } else if (typeof value === 'number') {
        record[header] = String(value)
        hasValue = true
      } else if (typeof value === 'object' && 'result' in (value as object)) {
        // Formula cell — use the cached result
        const result = (value as { result: unknown }).result
        if (result instanceof Date) {
          record[header] = formatDateUTC(result)
          hasValue = true
        } else {
          record[header] = String(result ?? '')
          hasValue = hasValue || record[header] !== ''
        }
      } else {
        record[header] = String(value)
        hasValue = hasValue || String(value) !== ''
      }
    })

    if (hasValue) rows.push(record)
  })

  return rows
}

/**
 * Sanitize a string value so it cannot be interpreted as a spreadsheet
 * formula when written to an Excel cell. Prefixes dangerous leading
 * characters with a single-quote text escape.
 */
export function sanitizeCellValue(value: string): string {
  if (value.length === 0) return value
  const first = value[0]
  const isNegativeNumber = /^-(?:\d+|\d*\.\d+)$/.test(value)
  if (
    first === '=' ||
    first === '+' ||
    first === '@' ||
    first === '\t' ||
    first === '\r' ||
    first === '\n'
  ) {
    return `'${value}`
  }
  // Leading minus is only dangerous when followed by a non-digit (e.g. `-SUM()`).
  // Numeric negatives like `-85.79` and `-.5` are safe and must stay as-is.
  if (first === '-' && !isNegativeNumber) {
    return `'${value}`
  }
  return value
}
