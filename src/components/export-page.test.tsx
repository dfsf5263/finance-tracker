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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

async function fillDates(user: ReturnType<typeof userEvent.setup>) {
  // The CustomDatePicker renders a button that opens a popover — we need to
  // interact with the component via its trigger buttons.
  const startButton = screen.getByPlaceholderText('Pick start date')
  const endButton = screen.getByPlaceholderText('Pick end date')

  // CustomDatePicker uses value/onChange — we simulate by looking for them.
  // Since we can't easily drive the date picker popover in unit tests, we'll
  // test the count preview / button state via direct state manipulation.
  // Instead, let's test the rendered output given various states.
  // For full interaction tests, we rely on E2E.
  return { startButton, endButton }
}

// ── Tests ───────────────────────────────────────────────────

describe('ExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
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
})
