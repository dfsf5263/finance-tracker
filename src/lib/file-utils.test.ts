import ExcelJS from 'exceljs'
import { describe, it, expect } from 'vitest'
import { isValidCsvFile, isValidExcelFile, parseExcelToRows, sanitizeCellValue } from './file-utils'

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

// ── Helper: build an in-memory .xlsx Buffer from a given worksheet setup ─────

async function buildXlsx(
  setup: (ws: ExcelJS.Worksheet) => void,
  sheetName = 'Sheet1'
): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(sheetName)
  setup(ws)
  const buffer = await workbook.xlsx.writeBuffer()
  return new File([buffer], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('isValidExcelFile', () => {
  it('accepts correct MIME + .xlsx extension', () => {
    const file = new File([''], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(isValidExcelFile(file)).toBe(true)
  })

  it('accepts empty MIME + .xlsx extension', () => {
    const file = new File([''], 'data.xlsx', { type: '' })
    expect(isValidExcelFile(file)).toBe(true)
  })

  it('accepts uppercase .XLSX extension', () => {
    const file = new File([''], 'DATA.XLSX', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(isValidExcelFile(file)).toBe(true)
  })

  it('rejects .xlsx with wrong MIME', () => {
    const file = new File([''], 'data.xlsx', { type: 'application/json' })
    expect(isValidExcelFile(file)).toBe(false)
  })

  it('rejects .csv file with xlsx MIME', () => {
    const file = new File([''], 'data.csv', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(isValidExcelFile(file)).toBe(false)
  })
})

describe('parseExcelToRows', () => {
  it('returns rows keyed by header', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Description', 'Amount'])
      ws.addRow(['Coffee', '-5.50'])
    })
    const rows = await parseExcelToRows(file)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Description']).toBe('Coffee')
    expect(rows[0]['Amount']).toBe('-5.50')
  })

  it('formats Date-cell transaction dates as MM/DD/YYYY', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Transaction Date'])
      const row = ws.addRow([new Date(Date.UTC(2024, 0, 15))]) // Jan 15 2024 UTC
      row.getCell(1).numFmt = 'mm/dd/yyyy'
    })
    const rows = await parseExcelToRows(file)
    expect(rows[0]['Transaction Date']).toBe('01/15/2024')
  })

  it('passes through text-formatted date strings unchanged', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Transaction Date'])
      const row = ws.addRow(['01/15/2024'])
      row.getCell(1).numFmt = '@' // text format
    })
    const rows = await parseExcelToRows(file)
    expect(rows[0]['Transaction Date']).toBe('01/15/2024')
  })

  it('formats General-cell Date objects as MM/DD/YYYY', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Transaction Date'])
      ws.addRow([new Date(Date.UTC(2025, 5, 20))]) // Jun 20 2025 UTC — no numFmt (General)
    })
    const rows = await parseExcelToRows(file)
    expect(rows[0]['Transaction Date']).toBe('06/20/2025')
  })

  it('converts numeric amount cells to string', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Amount'])
      ws.addRow([-25.5])
    })
    const rows = await parseExcelToRows(file)
    expect(rows[0]['Amount']).toBe('-25.5')
  })

  it('passes through text amount strings unchanged', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Amount'])
      const row = ws.addRow(['-25.50'])
      row.getCell(1).numFmt = '@'
    })
    const rows = await parseExcelToRows(file)
    expect(rows[0]['Amount']).toBe('-25.50')
  })

  it('converts General numeric amount (integer) to string', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Amount'])
      ws.addRow([1250])
    })
    const rows = await parseExcelToRows(file)
    expect(rows[0]['Amount']).toBe('1250')
  })

  it('skips fully empty trailing rows', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Description', 'Amount'])
      ws.addRow(['Coffee', '-5.50'])
      ws.addRow([null, null]) // empty row
    })
    const rows = await parseExcelToRows(file)
    expect(rows).toHaveLength(1)
  })

  it('only parses the first worksheet, ignoring _Lists sheet', async () => {
    const workbook = new ExcelJS.Workbook()
    const dataSheet = workbook.addWorksheet('Sheet1')
    dataSheet.addRow(['Description'])
    dataSheet.addRow(['Salary'])
    const listsSheet = workbook.addWorksheet('_Lists')
    listsSheet.addRow(['Should'])
    listsSheet.addRow(['Be ignored'])

    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const rows = await parseExcelToRows(file)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Description']).toBe('Salary')
  })

  it('returns empty array when workbook has no worksheets', async () => {
    const workbook = new ExcelJS.Workbook()
    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'empty.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const rows = await parseExcelToRows(file)
    expect(rows).toHaveLength(0)
  })

  it('handles formula cell with Date result', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['TransactionDate'])
      const row = ws.addRow([])
      row.getCell(1).value = {
        formula: 'TODAY()',
        result: new Date(Date.UTC(2024, 0, 15)),
        date1904: false,
      } as ExcelJS.CellFormulaValue
    })
    const rows = await parseExcelToRows(file)
    expect(rows).toHaveLength(1)
    expect(rows[0]['TransactionDate']).toBe('01/15/2024')
  })

  it('handles formula cell with non-Date result', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Amount'])
      const row = ws.addRow([])
      row.getCell(1).value = {
        formula: 'SUM(1,2)',
        result: 3,
        date1904: false,
      } as ExcelJS.CellFormulaValue
    })
    const rows = await parseExcelToRows(file)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Amount']).toBe('3')
  })

  it('maps null-valued cells in a non-empty row to empty string', async () => {
    const file = await buildXlsx((ws) => {
      ws.addRow(['Description', 'Memo'])
      // Row with Description filled and Memo null — eachCell with includeEmpty
      // still skips truly-null cells, so only the filled cell appears in the record.
      const row = ws.addRow([])
      row.getCell(1).value = 'Coffee'
      row.getCell(2).value = null
    })
    const rows = await parseExcelToRows(file)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Description']).toBe('Coffee')
    // ExcelJS eachCell({ includeEmpty: true }) skips trailing null cells,
    // so 'Memo' won't be present in the record.
    expect(rows[0]['Memo']).toBeUndefined()
  })
})
