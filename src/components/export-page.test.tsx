vi.mock('@/contexts/household-context', () => ({
  useHousehold: vi.fn(),
}))

vi.mock('@/lib/http-utils', () => ({
  apiFetch: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('exceljs', () => {
  const mockCell = {
    fill: undefined as unknown,
    font: undefined as unknown,
    alignment: undefined as unknown,
    value: undefined as unknown,
    dataValidation: undefined as unknown,
  }
  const mockRow = {
    eachCell: vi.fn((cb: (cell: typeof mockCell) => void) => cb(mockCell)),
    height: 0,
  }
  const mockColumn = { numFmt: '' }
  const mockWorksheet = {
    columns: [],
    getRow: vi.fn(() => mockRow),
    getColumn: vi.fn(() => mockColumn),
    addRow: vi.fn(),
    getCell: vi.fn(() => mockCell),
  }
  const mockBuffer = new ArrayBuffer(8)
  class MockWorkbook {
    creator = ''
    created: Date | null = null
    addWorksheet = vi.fn(() => mockWorksheet)
    xlsx = { writeBuffer: vi.fn(async () => mockBuffer) }
  }
  return {
    default: { Workbook: MockWorkbook },
  }
})

vi.mock('@/components/ui/date-picker', () => ({
  CustomDatePicker: ({
    onChange,
    placeholder,
    disabled,
  }: {
    onChange?: (v: string) => void
    placeholder?: string
    disabled?: boolean
  }) => (
    <input
      placeholder={placeholder}
      disabled={disabled ?? false}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    children: React.ReactNode
  }) => (
    <select value={value ?? ''} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="" disabled>
      {placeholder}
    </option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportPage } from './export-page'
import { useHousehold } from '@/contexts/household-context'
import { apiFetch } from '@/lib/http-utils'
import { toast } from 'sonner'

// ── Helpers ─────────────────────────────────────────────────

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

function setupNoHousehold() {
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
}

function mockCountResponse(total: number) {
  vi.mocked(apiFetch).mockResolvedValue({
    data: {
      transactions: [],
      pagination: { page: 1, limit: 1, total, pages: Math.ceil(total / 1000) || 1 },
    },
    error: null,
    response: new Response(),
  })
}

function mockEntityAndCountResponses(total: number) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (url.includes('/api/transactions')) {
      return {
        data: {
          transactions: [],
          pagination: { page: 1, limit: 1, total, pages: Math.ceil(total / 1000) || 1 },
        },
        error: null,
        response: new Response(),
      }
    }
    // Entity endpoints
    return { data: [], error: null, response: new Response() }
  })
}

function mockForExport(
  total: number,
  transactions: Array<{
    id: string
    description: string
    amount: number
    memo: string | null
    transactionDate: string
    postDate: string | null
    account: { name: string } | null
    user: { name: string } | null
    category: { name: string } | null
    type: { name: string } | null
  }>
) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (url.includes('/api/transactions') && url.includes('limit=1&')) {
      // Count check
      return {
        data: {
          transactions: [],
          pagination: { page: 1, limit: 1, total, pages: Math.ceil(total / 1000) || 1 },
        },
        error: null,
        response: new Response(),
      }
    }
    if (url.includes('/api/transactions') && url.includes('limit=1000')) {
      // Full export fetch
      return {
        data: {
          transactions,
          pagination: { page: 1, limit: 1000, total: transactions.length, pages: 1 },
        },
        error: null,
        response: new Response(),
      }
    }
    // Entity endpoints
    return { data: [], error: null, response: new Response() }
  })
}

function fillDates(start: string, end: string) {
  const startInput = screen.getByPlaceholderText('Pick start date')
  const endInput = screen.getByPlaceholderText('Pick end date')
  fireEvent.change(startInput, { target: { value: start } })
  fireEvent.change(endInput, { target: { value: end } })
}

// ── Tests ───────────────────────────────────────────────────

const mockTransaction = {
  id: 'tx-1',
  description: 'Coffee',
  amount: 4.5,
  memo: null,
  transactionDate: '2024-01-15T00:00:00.000Z',
  postDate: null,
  account: { name: 'Checking' },
  user: { name: 'Alice' },
  category: { name: 'Food' },
  type: { name: 'Debit' },
}

describe('ExportPage', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createObjectURL = vi.fn().mockReturnValue('blob:mock')
    revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      configurable: true,
      writable: true,
    })
  })

  it('renders format select, date pickers, and export button', () => {
    setupHousehold()
    mockEntityAndCountResponses(0)
    render(<ExportPage />)

    expect(screen.getByText('File Format')).toBeInTheDocument()
    expect(screen.getByText('Start Date')).toBeInTheDocument()
    expect(screen.getByText('End Date')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('shows household warning when no household selected', () => {
    setupNoHousehold()
    render(<ExportPage />)

    expect(screen.getByText('Select a household to export transactions.')).toBeInTheDocument()
  })

  it('export button is disabled by default', () => {
    setupHousehold()
    mockEntityAndCountResponses(0)
    render(<ExportPage />)

    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled()
  })

  it('renders the format select trigger', () => {
    setupHousehold()
    mockEntityAndCountResponses(0)
    render(<ExportPage />)

    expect(screen.getByText('Select a format')).toBeInTheDocument()
  })

  it('export button is disabled when no household selected', () => {
    setupNoHousehold()
    render(<ExportPage />)

    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled()
  })

  it('shows transaction count after valid date range is entered', async () => {
    setupHousehold()
    mockEntityAndCountResponses(42)
    render(<ExportPage />)

    fillDates('2024-01-01', '2024-01-31')

    await waitFor(() => {
      expect(screen.getByText('42 transactions')).toBeInTheDocument()
    })
  })

  it('shows zero-transactions warning when count is 0', async () => {
    setupHousehold()
    mockEntityAndCountResponses(0)
    render(<ExportPage />)

    fillDates('2024-01-01', '2024-01-31')

    await waitFor(() => {
      expect(
        screen.getByText('No transactions found for the selected date range')
      ).toBeInTheDocument()
    })
  })

  it('shows date range error when start is after end', async () => {
    setupHousehold()
    mockEntityAndCountResponses(0)
    render(<ExportPage />)

    fillDates('2024-02-01', '2024-01-01')

    expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
  })

  it('shows large export warning when count exceeds 10,000', async () => {
    setupHousehold()
    mockEntityAndCountResponses(15_000)
    render(<ExportPage />)

    fillDates('2024-01-01', '2024-12-31')

    await waitFor(() => {
      expect(screen.getByText(/15,000 transactions and may take a moment/i)).toBeInTheDocument()
    })
  })

  it('exports CSV and triggers download', async () => {
    setupHousehold()
    mockForExport(1, [mockTransaction])
    render(<ExportPage />)

    // Select CSV format
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'csv' } })

    // Set dates
    fillDates('2024-01-01', '2024-01-31')

    // Wait for count to load and enable Export button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('1 transactions'))
    })
  })

  it('shows error toast when fetch fails during export', async () => {
    setupHousehold()

    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes('limit=1&')) {
        // Count check succeeds
        return {
          data: {
            transactions: [],
            pagination: { page: 1, limit: 1, total: 5, pages: 1 },
          },
          error: null,
          response: new Response(),
        }
      }
      // Export fetch fails
      return { data: null, error: 'Network error', response: new Response() }
    })

    render(<ExportPage />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'csv' } })
    fillDates('2024-01-01', '2024-01-31')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to export transactions. Please try again.')
    })
  })

  it('shows loading indicator while count is being fetched', async () => {
    setupHousehold()

    let resolveCount: (v: unknown) => void
    const countPromise = new Promise((res) => {
      resolveCount = res
    })

    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes('limit=1&')) {
        await countPromise
        return {
          data: {
            transactions: [],
            pagination: { page: 1, limit: 1, total: 3, pages: 1 },
          },
          error: null,
          response: new Response(),
        }
      }
      return { data: [], error: null, response: new Response() }
    })

    render(<ExportPage />)
    fillDates('2024-01-01', '2024-01-31')

    expect(screen.getByText(/checking transaction count/i)).toBeInTheDocument()

    resolveCount!(null)
    await waitFor(() => {
      expect(screen.queryByText(/checking transaction count/i)).not.toBeInTheDocument()
      expect(screen.getByText('3 transactions')).toBeInTheDocument()
    })
  })

  it('exports Excel and triggers download', async () => {
    setupHousehold()
    mockForExport(1, [mockTransaction])
    render(<ExportPage />)

    // Select Excel format
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'excel' } })

    // Set dates
    fillDates('2024-01-01', '2024-01-31')

    // Wait for count to load and enable Export button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('1 transactions'))
    })
  })

  it('shows zero-transaction error when export returns no data', async () => {
    setupHousehold()

    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes('limit=1&')) {
        return {
          data: {
            transactions: [],
            pagination: { page: 1, limit: 1, total: 5, pages: 1 },
          },
          error: null,
          response: new Response(),
        }
      }
      if (url.includes('limit=1000')) {
        return {
          data: {
            transactions: [],
            pagination: { page: 1, limit: 1000, total: 0, pages: 1 },
          },
          error: null,
          response: new Response(),
        }
      }
      return { data: [], error: null, response: new Response() }
    })

    render(<ExportPage />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'csv' } })
    fillDates('2024-01-01', '2024-01-31')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No transactions found for the selected date range')
    })
  })

  it('fetches entities when a household is selected', async () => {
    setupHousehold()
    mockEntityAndCountResponses(0)
    render(<ExportPage />)

    await waitFor(() => {
      const calls = vi.mocked(apiFetch).mock.calls.map((c) => c[0] as string)
      expect(calls.some((url) => url.includes('/api/accounts'))).toBe(true)
      expect(calls.some((url) => url.includes('/api/users'))).toBe(true)
      expect(calls.some((url) => url.includes('/api/categories'))).toBe(true)
      expect(calls.some((url) => url.includes('/api/types'))).toBe(true)
    })
  })

  it('escapes CSV fields containing commas', async () => {
    setupHousehold()
    mockForExport(1, [
      {
        ...mockTransaction,
        description: 'Food, Drinks',
        memo: 'has "quotes"',
      },
    ])
    render(<ExportPage />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'csv' } })
    fillDates('2024-01-01', '2024-01-31')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it('handles count fetch catch path on abort', async () => {
    setupHousehold()

    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes('limit=1&')) {
        throw new Error('aborted')
      }
      return { data: [], error: null, response: new Response() }
    })

    render(<ExportPage />)
    fillDates('2024-01-01', '2024-01-31')

    await waitFor(() => {
      expect(screen.queryByText(/checking transaction count/i)).not.toBeInTheDocument()
    })
  })
})
