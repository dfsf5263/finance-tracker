import { describe, it, expect } from 'vitest'
import { INSTITUTIONS, mapCsvRow, validateHeaders } from './csv-converter'
import { parseInstitutionDate } from '@/lib/date-utils'

describe('INSTITUTIONS config', () => {
  it('fidelity maps Date, Name, Amount and does not invert', () => {
    const cfg = INSTITUTIONS.fidelity
    expect(cfg.label).toBe('Fidelity')
    expect(cfg.mapping).toEqual({
      Date: 'transactionDate',
      Name: 'description',
      Amount: 'amount',
    })
    expect(cfg.invertAmount).toBe(false)
    expect(cfg.dateFormat).toBe('iso')
  })

  it('amex maps Date, Description, Amount and inverts amounts', () => {
    const cfg = INSTITUTIONS.amex
    expect(cfg.label).toBe('American Express')
    expect(cfg.mapping).toEqual({
      Date: 'transactionDate',
      Description: 'description',
      Amount: 'amount',
    })
    expect(cfg.invertAmount).toBe(true)
    expect(cfg.dateFormat).toBe('mdy')
  })

  it('chase maps Transaction Date, Post Date, Description, Amount', () => {
    const cfg = INSTITUTIONS.chase
    expect(cfg.label).toBe('Chase')
    expect(cfg.mapping).toEqual({
      'Transaction Date': 'transactionDate',
      'Post Date': 'postDate',
      Description: 'description',
      Amount: 'amount',
    })
    expect(cfg.invertAmount).toBe(false)
    expect(cfg.dateFormat).toBe('mdy')
  })

  it('wellsfargo maps Transaction Date, Amount, Category (as description) and does not invert', () => {
    const cfg = INSTITUTIONS.wellsfargo
    expect(cfg.label).toBe('Wells Fargo')
    expect(cfg.mapping).toEqual({
      'Transaction Date': 'transactionDate',
      Amount: 'amount',
      Category: 'description',
    })
    expect(cfg.invertAmount).toBe(false)
    expect(cfg.dateFormat).toBe('mdy')
  })
})

describe('parseInstitutionDate', () => {
  it('parses ISO format (YYYY-MM-DD)', () => {
    const result = parseInstitutionDate('2026-02-02', 'iso')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getUTCFullYear()).toBe(2026)
    expect(result!.getUTCMonth()).toBe(1) // 0-indexed
    expect(result!.getUTCDate()).toBe(2)
    expect(result!.getUTCHours()).toBe(12)
  })

  it('parses MDY format (MM/DD/YYYY)', () => {
    const result = parseInstitutionDate('02/19/2026', 'mdy')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getUTCFullYear()).toBe(2026)
    expect(result!.getUTCMonth()).toBe(1)
    expect(result!.getUTCDate()).toBe(19)
    expect(result!.getUTCHours()).toBe(12)
  })

  it('returns null for empty string', () => {
    expect(parseInstitutionDate('', 'iso')).toBeNull()
    expect(parseInstitutionDate('', 'mdy')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(parseInstitutionDate('   ', 'iso')).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(parseInstitutionDate('not-a-date', 'iso')).toBeNull()
    expect(parseInstitutionDate('13/32/2026', 'mdy')).toBeNull()
  })

  it('trims whitespace before parsing', () => {
    const result = parseInstitutionDate('  2026-02-02  ', 'iso')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getUTCDate()).toBe(2)
  })
})

describe('mapCsvRow', () => {
  it('maps a fidelity expense row (negative amount stays negative)', () => {
    const row = {
      Date: '2026-02-02',
      Transaction: 'DEBIT',
      Name: 'Blizzard Entertainment',
      Memo: 'stuff',
      Amount: '-85.79',
    }
    const result = mapCsvRow(row, INSTITUTIONS.fidelity)
    expect(result.transactionDate).toBeInstanceOf(Date)
    expect(result.transactionDate!.getUTCFullYear()).toBe(2026)
    expect(result.description).toBe('Blizzard Entertainment')
    expect(result.amount).toBe(-85.79)
    expect(result.postDate).toBeNull()
  })

  it('maps a fidelity credit row (positive amount stays positive)', () => {
    const row = {
      Date: '2026-02-10',
      Transaction: 'CREDIT',
      Name: 'Direct Deposit',
      Memo: '',
      Amount: '2500.00',
    }
    const result = mapCsvRow(row, INSTITUTIONS.fidelity)
    expect(result.amount).toBe(2500.0)
  })

  it('maps an amex expense row (positive → negative via inversion)', () => {
    const row = {
      Date: '02/19/2026',
      Description: 'UBER ONE',
      'Card Member': 'X',
      'Account #': '-51004',
      Amount: '9.99',
    }
    const result = mapCsvRow(row, INSTITUTIONS.amex)
    expect(result.amount).toBe(-9.99)
    expect(result.description).toBe('UBER ONE')
  })

  it('maps an amex credit row (negative → positive via inversion)', () => {
    const row = {
      Date: '02/20/2026',
      Description: 'REFUND',
      'Card Member': 'X',
      'Account #': '-51004',
      Amount: '-25.00',
    }
    const result = mapCsvRow(row, INSTITUTIONS.amex)
    expect(result.amount).toBe(25.0)
  })

  it('maps a chase row with post date', () => {
    const row = {
      'Transaction Date': '02/27/2026',
      'Post Date': '02/27/2026',
      Description: 'AUTOMATIC PAYMENT',
      Category: '',
      Type: 'Payment',
      Amount: '1916.14',
      Memo: '',
    }
    const result = mapCsvRow(row, INSTITUTIONS.chase)
    expect(result.transactionDate).toBeInstanceOf(Date)
    expect(result.postDate).toBeInstanceOf(Date)
    expect(result.postDate!.getUTCDate()).toBe(27)
    expect(result.description).toBe('AUTOMATIC PAYMENT')
    expect(result.amount).toBe(1916.14)
  })

  it('maps a wells fargo expense row (Category used as description)', () => {
    const row = {
      'Transaction Date': '02/27/2026',
      Amount: '-31.87',
      Memo: '*',
      Description: '',
      Category: 'BRIGHTLEAF BOOKSHOP',
      Type: '',
    }
    const result = mapCsvRow(row, INSTITUTIONS.wellsfargo)
    expect(result.transactionDate).toBeInstanceOf(Date)
    expect(result.transactionDate!.getUTCDate()).toBe(27)
    expect(result.description).toBe('BRIGHTLEAF BOOKSHOP')
    expect(result.amount).toBe(-31.87)
    expect(result.postDate).toBeNull()
  })

  it('maps a wells fargo credit row (positive amount stays positive)', () => {
    const row = {
      'Transaction Date': '02/28/2026',
      Amount: '500.00',
      Memo: '',
      Description: '',
      Category: 'DIRECT DEPOSIT',
      Type: '',
    }
    const result = mapCsvRow(row, INSTITUTIONS.wellsfargo)
    expect(result.amount).toBe(500.0)
    expect(result.description).toBe('DIRECT DEPOSIT')
  })

  it('strips $ and , from amounts', () => {
    const row = { Date: '2026-01-01', Name: 'Test', Amount: '$1,234.56' }
    const result = mapCsvRow(row, INSTITUTIONS.fidelity)
    expect(result.amount).toBe(1234.56)
  })

  it('handles missing columns gracefully', () => {
    const row = { Date: '2026-01-01' }
    const result = mapCsvRow(row, INSTITUTIONS.fidelity)
    expect(result.description).toBe('')
    expect(result.amount).toBe(null)
  })

  it('defaults to null for non-numeric amount', () => {
    const row = { Date: '2026-01-01', Name: 'Test', Amount: 'N/A' }
    const result = mapCsvRow(row, INSTITUTIONS.fidelity)
    expect(result.amount).toBe(null)
  })
})

describe('validateHeaders', () => {
  it('returns empty array when all expected headers are present', () => {
    const headers = ['Date', 'Transaction', 'Name', 'Memo', 'Amount']
    expect(validateHeaders(headers, INSTITUTIONS.fidelity)).toEqual([])
  })

  it('returns missing headers for fidelity CSV', () => {
    const headers = ['Date', 'Transaction']
    const missing = validateHeaders(headers, INSTITUTIONS.fidelity)
    expect(missing).toContain('Name')
    expect(missing).toContain('Amount')
    expect(missing).not.toContain('Date')
  })

  it('handles chase headers with spaces', () => {
    const headers = [
      'Transaction Date',
      'Post Date',
      'Description',
      'Category',
      'Type',
      'Amount',
      'Memo',
    ]
    expect(validateHeaders(headers, INSTITUTIONS.chase)).toEqual([])
  })

  it('returns all expected headers when CSV has completely wrong columns', () => {
    const headers = ['Wrong', 'Columns', 'Here']
    const missing = validateHeaders(headers, INSTITUTIONS.fidelity)
    expect(missing).toEqual(['Date', 'Name', 'Amount'])
  })

  it('handles header with extra whitespace via trim', () => {
    const headers = [' Date ', ' Name ', ' Amount ']
    expect(validateHeaders(headers, INSTITUTIONS.fidelity)).toEqual([])
  })
})
