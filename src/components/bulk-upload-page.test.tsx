'use client'

import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BulkUploadPage } from './bulk-upload-page'

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/lib/file-utils', () => ({
  isValidCsvFile: vi.fn(),
  isValidExcelFile: vi.fn(),
  parseExcelToRows: vi.fn(),
}))

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}))

vi.mock('@/lib/http-utils', () => ({
  apiFetch: vi.fn().mockResolvedValue({ data: [], error: null }),
}))

vi.mock('@/contexts/household-context', () => ({
  useHousehold: vi.fn(),
}))

vi.mock('@/hooks/use-active-month', () => ({
  invalidateActiveMonthCache: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/components/failed-transactions-grid', () => ({
  FailedTransactionsGrid: vi.fn(({ mode, failures, onRowsChange }) => (
    <div data-testid="failed-transactions-grid" data-mode={mode}>
      {failures.length} failures
      {onRowsChange && (
        <button
          data-testid="simulate-row-edit"
          onClick={() =>
            onRowsChange(
              failures.map((f: { index: number; transaction: Record<string, string> }) => ({
                failure: f,
                status: 'modified',
                editedTransactionDate: f.transaction.transactionDate,
                editedDescription: `${f.transaction.description} (2)`,
                editedAmount: f.transaction.amount,
              }))
            )
          }
        >
          Edit rows
        </button>
      )}
    </div>
  )),
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import * as fileUtils from '@/lib/file-utils'
import Papa from 'papaparse'
import { useHousehold } from '@/contexts/household-context'
import { apiFetch } from '@/lib/http-utils'
import { toast } from 'sonner'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string): File {
  return new File(['content'], name, { type })
}

function setupHousehold() {
  vi.mocked(useHousehold).mockReturnValue({
    selectedHousehold: { id: 'hh-1', name: 'Test Household' },
    getUserRole: () => 'OWNER',
    households: [],
    isLoading: false,
    requiresHouseholdCreation: false,
    selectHousehold: vi.fn(),
    refreshHouseholds: vi.fn(),
    triggerHouseholdCreation: vi.fn(),
    completeHouseholdCreation: vi.fn(),
  } as unknown as ReturnType<typeof useHousehold>)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BulkUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupHousehold()
    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(false)
    vi.mocked(fileUtils.isValidExcelFile).mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
  })

  it('routes a valid CSV file through PapaParse', async () => {
    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(true)

    const parseRows = [
      {
        Account: 'Checking',
        'Transaction Date': '01/15/2024',
        Description: 'Coffee',
        Amount: '-5.00',
        Category: 'Food',
        Type: 'Sale',
        User: '',
        'Post Date': '',
        Memo: '',
      },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Papa.parse as any).mockImplementationOnce((_file: unknown, opts: Papa.ParseConfig) => {
      opts.complete?.({ data: parseRows, errors: [], meta: {} as Papa.ParseMeta }, undefined)
      return {} as Papa.ParseResult<unknown>
    })

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const csvFile = makeFile('transactions.csv', 'text/csv')
    fireEvent.change(input, { target: { files: [csvFile] } })

    await waitFor(() => {
      expect(Papa.parse).toHaveBeenCalledWith(csvFile, expect.objectContaining({ header: true }))
    })
    expect(fileUtils.parseExcelToRows).not.toHaveBeenCalled()
  })

  it('routes a valid Excel file through parseExcelToRows', async () => {
    vi.mocked(fileUtils.isValidExcelFile).mockReturnValue(true)
    vi.mocked(fileUtils.parseExcelToRows).mockResolvedValue([
      {
        Account: 'Checking',
        'Transaction Date': '01/15/2024',
        Description: 'Coffee',
        Amount: '-5.00',
        Category: 'Food',
        Type: 'Sale',
        User: '',
        'Post Date': '',
        Memo: '',
      },
    ])

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const xlsxFile = makeFile(
      'transactions.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    fireEvent.change(input, { target: { files: [xlsxFile] } })

    await waitFor(() => {
      expect(fileUtils.parseExcelToRows).toHaveBeenCalledWith(xlsxFile)
    })
    expect(Papa.parse).not.toHaveBeenCalled()

    // Advances to mapping step
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /map columns/i })).toBeInTheDocument()
    })
  })

  it('shows error toast for an invalid file type', async () => {
    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = makeFile('transactions.pdf', 'application/pdf')
    fireEvent.change(input, { target: { files: [badFile] } })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Please select a valid CSV or Excel')
      )
    })
    expect(Papa.parse).not.toHaveBeenCalled()
    expect(fileUtils.parseExcelToRows).not.toHaveBeenCalled()
  })

  it('shows error toast when Excel file is empty', async () => {
    vi.mocked(fileUtils.isValidExcelFile).mockReturnValue(true)
    vi.mocked(fileUtils.parseExcelToRows).mockResolvedValue([])

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const xlsxFile = makeFile(
      'empty.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    fireEvent.change(input, { target: { files: [xlsxFile] } })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('empty'))
    })
  })

  it('shows error toast when parseExcelToRows throws', async () => {
    vi.mocked(fileUtils.isValidExcelFile).mockReturnValue(true)
    vi.mocked(fileUtils.parseExcelToRows).mockRejectedValue(new Error('corrupt'))

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const xlsxFile = makeFile(
      'corrupt.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    fireEvent.change(input, { target: { files: [xlsxFile] } })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse Excel'))
    })
  })

  it('shows message when no household is selected', () => {
    vi.mocked(useHousehold).mockReturnValue({
      selectedHousehold: null,
      getUserRole: () => null,
      households: [],
      isLoading: false,
      requiresHouseholdCreation: false,
      selectHousehold: vi.fn(),
      refreshHouseholds: vi.fn(),
      triggerHouseholdCreation: vi.fn(),
      completeHouseholdCreation: vi.fn(),
    } as unknown as ReturnType<typeof useHousehold>)

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)
    expect(screen.getByText(/please select a household/i)).toBeInTheDocument()
  })

  it('shows view-only message for VIEWER role', () => {
    vi.mocked(useHousehold).mockReturnValue({
      selectedHousehold: { id: 'hh-1', name: 'Test Household' },
      getUserRole: () => 'VIEWER',
      households: [],
      isLoading: false,
      requiresHouseholdCreation: false,
      selectHousehold: vi.fn(),
      refreshHouseholds: vi.fn(),
      triggerHouseholdCreation: vi.fn(),
      completeHouseholdCreation: vi.fn(),
    } as unknown as ReturnType<typeof useHousehold>)

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)
    expect(screen.getByText(/view only access/i)).toBeInTheDocument()
  })

  it('accepts a file dropped onto the upload area', async () => {
    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Papa.parse as any).mockImplementationOnce((_file: unknown, opts: Papa.ParseConfig) => {
      opts.complete?.(
        {
          data: [
            {
              Account: 'Check',
              'Transaction Date': '01/15/2024',
              Description: 'Test',
              Amount: '-5',
              Category: 'Food',
              Type: 'Sale',
            },
          ],
          errors: [],
          meta: {} as Papa.ParseMeta,
        },
        undefined
      )
      return {} as Papa.ParseResult<unknown>
    })

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const csvFile = makeFile('transactions.csv', 'text/csv')
    const dropZone = document.querySelector('label[for="csv-upload"]') as HTMLElement

    fireEvent.dragOver(dropZone, {
      dataTransfer: { files: [] },
    })
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [csvFile] },
    })

    await waitFor(() => {
      expect(Papa.parse).toHaveBeenCalledWith(csvFile, expect.objectContaining({ header: true }))
    })
  })

  it('shows CSV parse error toast when PapaParse returns errors', async () => {
    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Papa.parse as any).mockImplementationOnce((_file: unknown, opts: Papa.ParseConfig) => {
      opts.complete?.(
        {
          data: [],
          errors: [
            { message: 'bad csv', row: 0, code: 'UndetectableDelimiter', type: 'Delimiter' },
          ],
          meta: {} as Papa.ParseMeta,
        },
        undefined
      )
      return {} as Papa.ParseResult<unknown>
    })

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('bad.csv', 'text/csv')] } })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error parsing CSV'))
    })
  })
})

// ── Dry-run integration tests ──────────────────────────────────────────────

describe('BulkUploadPage — dry-run integration', () => {
  const csvRows = [
    {
      Account: 'Checking',
      'Transaction Date': '01/15/2024',
      Description: 'Coffee',
      Amount: '-5.00',
      Category: 'Food',
      Type: 'Sale',
      User: 'Alice',
      'Post Date': '01/15/2024',
      Memo: '',
    },
    {
      Account: 'Checking',
      'Transaction Date': '01/16/2024',
      Description: 'Lunch',
      Amount: '-12.00',
      Category: 'Food',
      Type: 'Sale',
      User: 'Alice',
      'Post Date': '01/16/2024',
      Memo: '',
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockResponse = { ok: true } as any as Response

  function setupEntities() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, _opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/accounts'))
        return {
          data: [{ id: 'a1', name: 'Checking', householdId: 'hh-1' }],
          error: null,
          response: mockResponse,
        }
      if (typeof url === 'string' && url.includes('/api/categories'))
        return {
          data: [{ id: 'c1', name: 'Food', householdId: 'hh-1' }],
          error: null,
          response: mockResponse,
        }
      if (typeof url === 'string' && url.includes('/api/types'))
        return {
          data: [{ id: 't1', name: 'Sale', householdId: 'hh-1' }],
          error: null,
          response: mockResponse,
        }
      if (typeof url === 'string' && url.includes('/api/users'))
        return {
          data: [{ id: 'u1', name: 'Alice', householdId: 'hh-1' }],
          error: null,
          response: mockResponse,
        }
      return { data: null, error: null, response: mockResponse }
    })
  }

  async function navigateToPreview() {
    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Papa.parse as any).mockImplementationOnce((_file: unknown, opts: Papa.ParseConfig) => {
      opts.complete?.({ data: csvRows, errors: [], meta: {} as Papa.ParseMeta }, undefined)
      return {} as Papa.ParseResult<unknown>
    })

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    // Upload file
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('test.csv', 'text/csv')] } })

    // Wait for mapping step
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /map columns/i })).toBeInTheDocument()
    })

    // Click preview button
    fireEvent.click(screen.getByRole('button', { name: /continue to preview/i }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupHousehold()
    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(false)
    vi.mocked(fileUtils.isValidExcelFile).mockReturnValue(false)
  })

  it('"Continue to Preview" is disabled until entities are loaded', async () => {
    let resolveEntities: () => void
    const entityPromise = new Promise<void>((resolve) => {
      resolveEntities = resolve
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, _opts?: any) => {
      if (
        typeof url === 'string' &&
        (url.includes('/api/accounts') ||
          url.includes('/api/categories') ||
          url.includes('/api/types') ||
          url.includes('/api/users'))
      ) {
        await entityPromise
        return { data: [], error: null, response: { ok: true } as Response }
      }
      return { data: null, error: null, response: { ok: true } as Response }
    })

    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Papa.parse as any).mockImplementationOnce((_file: unknown, opts: Papa.ParseConfig) => {
      opts.complete?.({ data: csvRows, errors: [], meta: {} as Papa.ParseMeta }, undefined)
      return {} as Papa.ParseResult<unknown>
    })

    render(<BulkUploadPage onUploadComplete={vi.fn()} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('test.csv', 'text/csv')] } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /map columns/i })).toBeInTheDocument()
    })

    // Button should be disabled with loading text
    const button = screen.getByRole('button', { name: /loading household data/i })
    expect(button).toBeDisabled()

    // Resolve entity fetches
    resolveEntities!()

    // Button should become enabled with correct text
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to preview/i })).toBeEnabled()
    })
  })

  it('shows loading state during dry-run', async () => {
    // Setup entities first, then override apiFetch to handle validate
    let resolveValidate: (value: unknown) => void
    const validatePromise = new Promise((resolve) => {
      resolveValidate = resolve
    })

    setupEntities()
    // Override the apiFetch mock to hang on validate calls
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return validatePromise as ReturnType<typeof apiFetch>
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    // Should show loading state
    await waitFor(() => {
      expect(
        screen.getByText(/checking for duplicates and validating entities/i)
      ).toBeInTheDocument()
    })

    // Resolve the validate call
    resolveValidate!({
      data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
      error: null,
      response: mockResponse,
    })
  })

  it('shows green banner when all transactions pass dry-run', async () => {
    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
          error: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    await waitFor(() => {
      expect(screen.getByText(/all 2 transactions passed server validation/i)).toBeInTheDocument()
    })
  })

  it('renders FailedTransactionsGrid when dry-run has failures', async () => {
    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: {
            success: true,
            results: {
              total: 2,
              valid: 1,
              failed: 1,
              failures: [
                {
                  index: 0,
                  row: 1,
                  transaction: csvRows[0],
                  issues: [
                    {
                      kind: 'duplicate',
                      fields: ['transactionDate', 'description', 'amount'],
                      message: 'Duplicate transaction',
                    },
                  ],
                },
              ],
            },
          },
          error: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    await waitFor(() => {
      const grid = screen.getByTestId('failed-transactions-grid')
      expect(grid).toBeInTheDocument()
      expect(grid).toHaveAttribute('data-mode', 'preview')
    })

    expect(screen.getByText('1 failures')).toBeInTheDocument()
  })

  it('disables upload button during dry-run', async () => {
    let resolveValidate: (value: unknown) => void
    const validatePromise = new Promise((resolve) => {
      resolveValidate = resolve
    })

    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return validatePromise as ReturnType<typeof apiFetch>
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    await waitFor(() => {
      const uploadButton = screen.getByRole('button', { name: /validating/i })
      expect(uploadButton).toBeDisabled()
    })

    resolveValidate!({
      data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
      error: null,
      response: mockResponse,
    })
  })

  it('clears dry-run state when navigating back to mapping', async () => {
    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: {
            success: true,
            results: {
              total: 2,
              valid: 1,
              failed: 1,
              failures: [
                {
                  index: 0,
                  row: 1,
                  transaction: csvRows[0],
                  issues: [
                    {
                      kind: 'duplicate',
                      fields: ['transactionDate', 'description', 'amount'],
                      message: 'Duplicate',
                    },
                  ],
                },
              ],
            },
          },
          error: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    // Wait for dry-run grid to appear
    await waitFor(() => {
      expect(screen.getByTestId('failed-transactions-grid')).toBeInTheDocument()
    })

    // Go back to mapping
    fireEvent.click(screen.getByRole('button', { name: /back to mapping/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /map columns/i })).toBeInTheDocument()
    })

    // Grid should be gone
    expect(screen.queryByTestId('failed-transactions-grid')).not.toBeInTheDocument()
  })

  it('shows retry grid in COMPLETE step when upload has failures', async () => {
    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
          error: null,
          response: mockResponse,
        }
      }
      if (typeof url === 'string' && url.includes('/api/transactions/bulk') && opts) {
        return {
          data: {
            success: true,
            results: {
              total: 2,
              successful: 1,
              failed: 1,
              failures: [
                {
                  row: 2,
                  transaction: csvRows[1],
                  issues: [
                    {
                      kind: 'duplicate',
                      fields: ['transactionDate', 'description', 'amount'],
                      message: 'Duplicate transaction',
                    },
                  ],
                },
              ],
            },
          },
          error: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    // Wait for dry-run to complete
    await waitFor(() => {
      expect(screen.getByText(/all 2 transactions passed server validation/i)).toBeInTheDocument()
    })

    // Click upload
    fireEvent.click(screen.getByRole('button', { name: /upload 2 transactions/i }))

    // Wait for complete step with retry grid
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /upload complete/i })).toBeInTheDocument()
    })

    const grid = screen.getByTestId('failed-transactions-grid')
    expect(grid).toHaveAttribute('data-mode', 'complete')
    expect(screen.getByText('1 failures')).toBeInTheDocument()
  })

  it('COMPLETE step has no back button, only Upload Another File', async () => {
    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
          error: null,
          response: mockResponse,
        }
      }
      if (typeof url === 'string' && url.includes('/api/transactions/bulk') && opts) {
        return {
          data: {
            success: true,
            results: { total: 2, successful: 2, failed: 0, failures: [] },
          },
          error: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    await waitFor(() => {
      expect(screen.getByText(/all 2 transactions passed server validation/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /upload 2 transactions/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /upload complete/i })).toBeInTheDocument()
    })

    // No back button
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    // Upload another file button exists
    expect(screen.getByRole('button', { name: /upload another file/i })).toBeInTheDocument()
  })

  it('shows error toast and stays on preview when upload returns validation error', async () => {
    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
          error: null,
          response: mockResponse,
        }
      }
      if (typeof url === 'string' && url.includes('/api/transactions/bulk') && opts) {
        return {
          data: null,
          error: 'Validation failed: something bad',
          errorData: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    await waitFor(() => {
      expect(screen.getByText(/all 2 transactions passed server validation/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /upload 2 transactions/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Validation errors found'))
    })
  })

  it('shows error toast when upload returns missing entities error', async () => {
    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
          error: null,
          response: mockResponse,
        }
      }
      if (typeof url === 'string' && url.includes('/api/transactions/bulk') && opts) {
        return {
          data: null,
          error: 'Missing entities - accounts not found',
          errorData: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    await waitFor(() => {
      expect(screen.getByText(/all 2 transactions passed server validation/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /upload 2 transactions/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Missing entities'))
    })
  })

  it('calls onRetryComplete and updates stats when retry succeeds in COMPLETE step', async () => {
    const onRetryComplete = vi.fn()

    // First update the grid mock to capture and expose onRetryComplete
    const { FailedTransactionsGrid } = await import('@/components/failed-transactions-grid')
    vi.mocked(FailedTransactionsGrid).mockImplementation(
      ({ onRetryComplete: onRC, failures, mode, onRowsChange }) => (
        <div data-testid="failed-transactions-grid" data-mode={mode}>
          {failures.length} failures
          {onRC && (
            <button
              data-testid="simulate-retry-complete"
              onClick={() => onRC({ succeeded: 1, failed: 0 })}
            >
              Simulate retry complete
            </button>
          )}
          {onRowsChange && (
            <button data-testid="simulate-row-edit" onClick={() => onRowsChange([])}>
              Edit rows
            </button>
          )}
        </div>
      )
    )

    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
          error: null,
          response: mockResponse,
        }
      }
      if (typeof url === 'string' && url.includes('/api/transactions/bulk') && opts) {
        return {
          data: {
            success: true,
            results: {
              total: 2,
              successful: 1,
              failed: 1,
              failures: [
                {
                  row: 2,
                  transaction: csvRows[1],
                  issues: [{ kind: 'duplicate', fields: ['description'], message: 'Duplicate' }],
                },
              ],
            },
          },
          error: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    render(<BulkUploadPage onUploadComplete={onRetryComplete} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    vi.mocked(fileUtils.isValidCsvFile).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Papa.parse as any).mockImplementationOnce((_file: unknown, opts: Papa.ParseConfig) => {
      opts.complete?.({ data: csvRows, errors: [], meta: {} as Papa.ParseMeta }, undefined)
      return {} as Papa.ParseResult<unknown>
    })

    fireEvent.change(input, { target: { files: [makeFile('test.csv', 'text/csv')] } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /map columns/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /continue to preview/i }))

    await waitFor(() => {
      expect(screen.getByText(/all 2 transactions passed server validation/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /upload 2 transactions/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /upload complete/i })).toBeInTheDocument()
    })

    // Simulate retry complete from the grid
    fireEvent.click(screen.getByTestId('simulate-retry-complete'))

    // onUploadComplete (the prop) should be called
    await waitFor(() => {
      expect(onRetryComplete).toHaveBeenCalled()
    })
  })

  it('downloads failure report when failures exist', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    })

    setupEntities()
    const originalMock = vi.mocked(apiFetch).getMockImplementation()!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/validate')) {
        return {
          data: { success: true, results: { total: 2, valid: 2, failed: 0, failures: [] } },
          error: null,
          response: mockResponse,
        }
      }
      if (typeof url === 'string' && url.includes('/api/transactions/bulk') && opts) {
        return {
          data: {
            success: true,
            results: {
              total: 2,
              successful: 1,
              failed: 1,
              failures: [
                {
                  row: 2,
                  transaction: {
                    account: 'Checking',
                    transactionDate: '2024-01-15',
                    description: 'Coffee',
                    amount: '-5.00',
                    category: 'Food',
                    type: 'Sale',
                  },
                  issues: [{ kind: 'duplicate', fields: ['description'], message: 'Duplicate' }],
                  existingTransaction: undefined,
                },
              ],
            },
          },
          error: null,
          response: mockResponse,
        }
      }
      return originalMock(url, opts)
    })

    await navigateToPreview()

    await waitFor(() => {
      expect(screen.getByText(/all 2 transactions passed server validation/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /upload 2 transactions/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /upload complete/i })).toBeInTheDocument()
    })

    // Download failure report
    const downloadBtn = screen.getByRole('button', { name: /get failure report/i })
    fireEvent.click(downloadBtn)

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(revokeObjectURL).toHaveBeenCalled()
  })
})
