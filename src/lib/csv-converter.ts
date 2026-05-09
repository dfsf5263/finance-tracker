import { parseInstitutionDate } from '@/lib/date-utils'

// ── Types ───────────────────────────────────────────────────

export type InstitutionKey = 'fidelity' | 'amex' | 'chase' | 'wellsfargo'

export type MappedField = 'transactionDate' | 'postDate' | 'description' | 'amount'

export interface InstitutionConfig {
  label: string
  mapping: Record<string, MappedField>
  invertAmount: boolean
  dateFormat: 'iso' | 'mdy'
  amountNote: string
}

export interface OutputRow {
  transactionDate: Date | null
  postDate: Date | null
  description: string
  amount: number | null
}

// ── Institution configs derived from docs/CSV_CONVERTER.md ──

export const INSTITUTIONS: Record<InstitutionKey, InstitutionConfig> = {
  fidelity: {
    label: 'Fidelity',
    mapping: {
      Date: 'transactionDate',
      Name: 'description',
      Amount: 'amount',
    },
    invertAmount: false,
    dateFormat: 'iso',
    amountNote: 'Expenses are negative, credits are positive',
  },
  amex: {
    label: 'American Express',
    mapping: {
      Date: 'transactionDate',
      Description: 'description',
      Amount: 'amount',
    },
    invertAmount: true,
    dateFormat: 'mdy',
    amountNote: 'Amounts are inverted (expenses become negative, credits become positive)',
  },
  chase: {
    label: 'Chase',
    mapping: {
      'Transaction Date': 'transactionDate',
      'Post Date': 'postDate',
      Description: 'description',
      Amount: 'amount',
    },
    invertAmount: false,
    dateFormat: 'mdy',
    amountNote: 'Expenses are negative, credits are positive',
  },
  wellsfargo: {
    label: 'Wells Fargo',
    mapping: {
      Date: 'transactionDate',
      Description: 'description',
      Amount: 'amount',
    },
    invertAmount: false,
    dateFormat: 'mdy',
    amountNote: 'Expenses are negative, credits are positive',
  },
}

// ── Row mapping ─────────────────────────────────────────────

export function mapCsvRow(csvRow: Record<string, string>, config: InstitutionConfig): OutputRow {
  let transactionDate: Date | null = null
  let postDate: Date | null = null
  let description = ''
  let amount: number | null = null

  // Build a case-insensitive lookup of the row's keys (trimmed, lowercased).
  const rowByLowerKey = new Map<string, string>()
  for (const [key, value] of Object.entries(csvRow)) {
    rowByLowerKey.set(key.trim().toLowerCase(), value)
  }

  for (const [csvCol, field] of Object.entries(config.mapping)) {
    const raw = rowByLowerKey.get(csvCol.trim().toLowerCase())?.trim() ?? ''
    switch (field) {
      case 'transactionDate':
        transactionDate = parseInstitutionDate(raw, config.dateFormat)
        break
      case 'postDate':
        postDate = parseInstitutionDate(raw, config.dateFormat)
        break
      case 'description':
        description = raw
        break
      case 'amount': {
        const parsed = Number.parseFloat(raw.replace(/[,$]/g, ''))
        amount = Number.isFinite(parsed) ? (config.invertAmount ? parsed * -1 : parsed) : null
        break
      }
    }
  }

  return { transactionDate, postDate, description, amount }
}

// ── Header validation ───────────────────────────────────────

export function validateHeaders(csvHeaders: string[], config: InstitutionConfig): string[] {
  const expectedHeaders = Object.keys(config.mapping)
  const normalized = csvHeaders.map((ch) => ch.trim().toLowerCase())
  return expectedHeaders.filter((h) => !normalized.includes(h.trim().toLowerCase()))
}
