import { describe, it, expect } from 'vitest'
import { isValidCsvFile, sanitizeCellValue } from './file-utils'

function fakeFile(name: string, type: string): File {
  return new File(['content'], name, { type })
}

describe('isValidCsvFile', () => {
  it('accepts text/csv', () => {
    expect(isValidCsvFile(fakeFile('data.csv', 'text/csv'))).toBe(true)
  })

  it('accepts text/plain (Safari / Linux)', () => {
    expect(isValidCsvFile(fakeFile('data.csv', 'text/plain'))).toBe(true)
  })

  it('accepts application/vnd.ms-excel (Windows)', () => {
    expect(isValidCsvFile(fakeFile('data.csv', 'application/vnd.ms-excel'))).toBe(true)
  })

  it('accepts application/csv', () => {
    expect(isValidCsvFile(fakeFile('data.csv', 'application/csv'))).toBe(true)
  })

  it('accepts empty MIME type', () => {
    expect(isValidCsvFile(fakeFile('data.csv', ''))).toBe(true)
  })

  it('accepts uppercase .CSV extension', () => {
    expect(isValidCsvFile(fakeFile('DATA.CSV', 'text/csv'))).toBe(true)
  })

  it('rejects .txt even with text/plain MIME', () => {
    expect(isValidCsvFile(fakeFile('data.txt', 'text/plain'))).toBe(false)
  })

  it('rejects .xlsx', () => {
    expect(isValidCsvFile(fakeFile('data.xlsx', 'application/vnd.ms-excel'))).toBe(false)
  })

  it('rejects a csv-named file with application/json MIME', () => {
    expect(isValidCsvFile(fakeFile('data.csv', 'application/json'))).toBe(false)
  })

  it('rejects a csv-named file with text/html MIME', () => {
    expect(isValidCsvFile(fakeFile('data.csv', 'text/html'))).toBe(false)
  })

  it('rejects a file with no extension', () => {
    expect(isValidCsvFile(fakeFile('data', 'text/csv'))).toBe(false)
  })
})

describe('sanitizeCellValue', () => {
  it('returns empty string unchanged', () => {
    expect(sanitizeCellValue('')).toBe('')
  })

  it('returns normal text unchanged', () => {
    expect(sanitizeCellValue('Amazon Purchase')).toBe('Amazon Purchase')
  })

  it('prefixes = with single quote', () => {
    expect(sanitizeCellValue('=1+1')).toBe("'=1+1")
  })

  it('prefixes + with single quote', () => {
    expect(sanitizeCellValue('+CMD')).toBe("'+CMD")
  })

  it('prefixes @ with single quote', () => {
    expect(sanitizeCellValue('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('prefixes tab with single quote', () => {
    expect(sanitizeCellValue('\tcmd')).toBe("'\tcmd")
  })

  it('prefixes carriage return with single quote', () => {
    expect(sanitizeCellValue('\rcmd')).toBe("'\rcmd")
  })

  it('prefixes newline with single quote', () => {
    expect(sanitizeCellValue('\ncmd')).toBe("'\ncmd")
  })

  it('prefixes formula-like minus (e.g. -SUM)', () => {
    expect(sanitizeCellValue('-SUM(A1)')).toBe("'-SUM(A1)")
  })

  it('preserves negative numbers like -85.79', () => {
    expect(sanitizeCellValue('-85.79')).toBe('-85.79')
  })

  it('preserves negative decimals without a leading zero', () => {
    expect(sanitizeCellValue('-.5')).toBe('-.5')
  })

  it('preserves negative integers like -100', () => {
    expect(sanitizeCellValue('-100')).toBe('-100')
  })

  it('prefixes bare minus sign', () => {
    expect(sanitizeCellValue('-')).toBe("'-")
  })
})
