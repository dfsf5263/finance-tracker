import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { FailedTransactionsGrid, type FailureDetail } from '@/components/failed-transactions-grid'
import { useHousehold } from '@/contexts/household-context'
import { apiFetch } from '@/lib/http-utils'

vi.mock('@/contexts/household-context', () => ({
  useHousehold: vi.fn(),
}))

vi.mock('@/lib/http-utils', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function setupHousehold(role = 'OWNER') {
  vi.mocked(useHousehold).mockReturnValue({
    selectedHousehold: { id: 'hh-1', name: 'Test Household' },
    getUserRole: () => role,
    households: [],
    isLoading: false,
    requiresHouseholdCreation: false,
    selectHousehold: vi.fn(),
    refreshHouseholds: vi.fn(),
    triggerHouseholdCreation: vi.fn(),
    completeHouseholdCreation: vi.fn(),
  } as unknown as ReturnType<typeof useHousehold>)
}

function makeFailure(overrides: Partial<FailureDetail> = {}): FailureDetail {
  return {
    index: 0,
    row: 2,
    transaction: {
      account: 'Chase Checking',
      transactionDate: '2024-01-15',
      description: 'Coffee Shop',
      category: 'Food',
      type: 'Purchase',
      amount: '12.50',
      rowId: 'test-row-id-0',
    },
    issues: [
      {
        kind: 'duplicate',
        fields: ['transactionDate', 'description', 'amount'],
        message: 'Duplicate transaction exists in database',
      },
    ],
    existingTransaction: {
      createdAt: '2024-01-10T00:00:00.000Z',
      account: 'Chase Checking',
      amount: '12.50',
      description: 'Coffee Shop',
      transactionDate: '2024-01-15',
    },
    ...overrides,
  }
}

const HOUSEHOLD_ID = 'hh-1'

describe('FailedTransactionsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupHousehold()
  })

  describe('rendering', () => {
    it('renders failure rows with correct data', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      expect(screen.getByText('2')).toBeInTheDocument()
      // Summary shows description and issue message
      expect(screen.getByText('Coffee Shop')).toBeInTheDocument()
      expect(screen.getByText('Duplicate transaction exists in database')).toBeInTheDocument()
    })

    it('returns null when no visible rows', () => {
      const { container } = render(
        <FailedTransactionsGrid failures={[]} householdId={HOUSEHOLD_ID} mode="preview" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('shows summary bar with remaining count', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      expect(screen.getByText(/1 remaining/)).toBeInTheDocument()
    })
  })

  describe('editing', () => {
    it('updates description field on change', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      // Expand to see editable fields
      fireEvent.click(screen.getByLabelText('Expand details'))

      const descInput = screen.getByDisplayValue('Coffee Shop')
      fireEvent.change(descInput, { target: { value: 'Tea Shop' } })

      expect(screen.getByDisplayValue('Tea Shop')).toBeInTheDocument()
    })

    it('updates amount field on change', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      const amountInput = screen.getByDisplayValue('12.50')
      fireEvent.change(amountInput, { target: { value: '15.00' } })

      expect(screen.getByDisplayValue('15.00')).toBeInTheDocument()
    })

    it('shows modified count in summary after edit', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      const descInput = screen.getByDisplayValue('Coffee Shop')
      fireEvent.change(descInput, { target: { value: 'Tea Shop' } })

      expect(screen.getByText(/1 fixed/)).toBeInTheDocument()
    })

    it('reverts to pending when edited value matches original', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      const descInput = screen.getByDisplayValue('Coffee Shop')
      fireEvent.change(descInput, { target: { value: 'Tea Shop' } })
      expect(screen.getByText(/1 fixed/)).toBeInTheDocument()

      // Change back to original
      fireEvent.change(screen.getByDisplayValue('Tea Shop'), {
        target: { value: 'Coffee Shop' },
      })
      expect(screen.queryByText(/1 fixed/)).not.toBeInTheDocument()
    })
  })

  describe('auto-fix', () => {
    it('appends " (2)" to description for duplicate rows', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      const autoFixBtn = screen.getByLabelText('Auto-fix description')
      fireEvent.click(autoFixBtn)

      expect(screen.getByDisplayValue('Coffee Shop (2)')).toBeInTheDocument()
    })

    it('increments suffix when already present', () => {
      const failure = makeFailure({
        transaction: {
          ...makeFailure().transaction,
          description: 'Coffee Shop (2)',
        },
      })

      render(
        <FailedTransactionsGrid failures={[failure]} householdId={HOUSEHOLD_ID} mode="preview" />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      const autoFixBtn = screen.getByLabelText('Auto-fix description')
      fireEvent.click(autoFixBtn)

      expect(screen.getByDisplayValue('Coffee Shop (3)')).toBeInTheDocument()
    })

    it('does not show auto-fix button for entity failures', () => {
      render(
        <FailedTransactionsGrid
          failures={[
            makeFailure({
              issues: [
                {
                  kind: 'entity',
                  fields: ['account'],
                  message: 'Account "Chase Checking" not found',
                },
              ],
              existingTransaction: undefined,
            }),
          ]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      expect(screen.queryByLabelText('Auto-fix description')).not.toBeInTheDocument()
    })
  })

  describe('remove', () => {
    it('removes row when X is clicked', async () => {
      vi.useFakeTimers()

      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      const removeBtn = screen.getByLabelText('Remove row')
      fireEvent.click(removeBtn)

      // After animation timeout
      vi.advanceTimersByTime(300)

      // Grid should be gone (returns null when empty)
      expect(screen.queryByText('Coffee Shop')).not.toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  describe('pagination', () => {
    it('paginates when more than 25 rows', () => {
      const failures = Array.from({ length: 30 }, (_, i) =>
        makeFailure({
          index: i,
          row: i + 2,
          transaction: {
            ...makeFailure().transaction,
            description: `Item ${i}`,
          },
        })
      )

      render(
        <FailedTransactionsGrid failures={failures} householdId={HOUSEHOLD_ID} mode="preview" />
      )

      expect(screen.getByText(/Showing 1–25 of 30/)).toBeInTheDocument()
      expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    })

    it('navigates to next page', () => {
      const failures = Array.from({ length: 30 }, (_, i) =>
        makeFailure({
          index: i,
          row: i + 2,
          transaction: {
            ...makeFailure().transaction,
            description: `Item ${i}`,
          },
        })
      )

      render(
        <FailedTransactionsGrid failures={failures} householdId={HOUSEHOLD_ID} mode="preview" />
      )

      fireEvent.click(screen.getByLabelText('Next page'))
      expect(screen.getByText(/Showing 26–30 of 30/)).toBeInTheDocument()
    })
  })

  describe('preview mode', () => {
    it('does not show retry buttons in preview mode', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      expect(screen.queryByLabelText('Retry row')).not.toBeInTheDocument()
      expect(screen.queryByText('Retry All')).not.toBeInTheDocument()
    })

    it('calls onRowsChange when rows are edited', () => {
      const onRowsChange = vi.fn()

      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
          onRowsChange={onRowsChange}
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      const descInput = screen.getByDisplayValue('Coffee Shop')
      fireEvent.change(descInput, { target: { value: 'Tea Shop' } })

      expect(onRowsChange).toHaveBeenCalled()
    })
  })

  describe('complete mode', () => {
    it('shows retry and dismiss all buttons', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="complete"
        />
      )

      expect(screen.getByLabelText('Retry row')).toBeInTheDocument()
      expect(screen.getByText('Retry All')).toBeInTheDocument()
      expect(screen.getByText('Dismiss All')).toBeInTheDocument()
    })

    it('retries a single row successfully', async () => {
      vi.useFakeTimers()
      vi.mocked(apiFetch).mockResolvedValueOnce({
        data: { success: true, results: { successful: 1, failures: [] } },
        error: null,
        response: new Response(),
      } as never)

      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="complete"
        />
      )

      const retryBtn = screen.getByLabelText('Retry row')
      fireEvent.click(retryBtn)

      // Wait for the async handler
      await vi.advanceTimersByTimeAsync(50)

      expect(apiFetch).toHaveBeenCalledWith(
        '/api/transactions/bulk',
        expect.objectContaining({
          method: 'POST',
        })
      )

      vi.useRealTimers()
    })

    it('sets failed status on retry failure', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        data: {
          success: true,
          results: {
            successful: 0,
            failures: [
              { issues: [{ kind: 'duplicate', message: 'Still a duplicate', fields: [] }] },
            ],
          },
        },
        error: null,
        response: new Response(),
      } as never)

      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="complete"
        />
      )

      const retryBtn = screen.getByLabelText('Retry row')
      await fireEvent.click(retryBtn)

      // Wait for state update — status should change to 'failed'
      await vi.waitFor(() => {
        expect(screen.getByText('failed')).toBeInTheDocument()
      })
    })
  })

  describe('expanded details', () => {
    it('shows issue badges, fix fields, and transaction details when expanded', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      // Section headings
      expect(screen.getByText('Transaction Details')).toBeInTheDocument()
      expect(screen.getByText('Fix Required Fields')).toBeInTheDocument()

      // Issue message badge
      expect(
        screen.getAllByText('Duplicate transaction exists in database').length
      ).toBeGreaterThanOrEqual(1)

      // Non-affected fields shown as read-only in Transaction Details
      expect(screen.getAllByText('Chase Checking').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText('Purchase')).toBeInTheDocument()
    })

    it('shows existing transaction section for duplicates', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      expect(screen.getByText('Existing Transaction')).toBeInTheDocument()
    })

    it('expand toggle is available for entity failures too', () => {
      render(
        <FailedTransactionsGrid
          failures={[
            makeFailure({
              issues: [
                {
                  kind: 'entity',
                  fields: ['account'],
                  message: 'Account "Chase Checking" not found',
                },
              ],
              existingTransaction: undefined,
            }),
          ]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      expect(
        screen.getAllByText('Account "Chase Checking" not found').length
      ).toBeGreaterThanOrEqual(1)
      // No existing transaction section for entity failures
      expect(screen.queryByText('Existing Transaction')).not.toBeInTheDocument()
    })
  })

  describe('role-based access', () => {
    it('renders read-only for VIEWER role', () => {
      setupHousehold('VIEWER')

      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="complete"
        />
      )

      // No editable inputs
      expect(screen.queryByDisplayValue('Coffee Shop')).not.toBeInTheDocument()
      // No action buttons
      expect(screen.queryByLabelText('Remove row')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Retry row')).not.toBeInTheDocument()
    })
  })

  describe('entity dropdowns', () => {
    const entityFailure = makeFailure({
      issues: [
        {
          kind: 'entity',
          fields: ['account'],
          message: 'Account "Chase Checking" not found',
        },
      ],
      existingTransaction: undefined,
    })

    it('shows account dropdown when account is missing', () => {
      render(
        <FailedTransactionsGrid
          failures={[entityFailure]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
          accounts={[{ id: 'acct-1', name: 'Savings Account' }]}
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      // shadcn Select renders as role="combobox"
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('does not show entity dropdowns for duplicate failures', () => {
      render(
        <FailedTransactionsGrid
          failures={[makeFailure()]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
          accounts={[{ id: 'acct-1', name: 'Savings Account' }]}
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      // duplicate failures have no entity issues, so no Select comboboxes
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('does not show entity dropdowns for format failures', () => {
      render(
        <FailedTransactionsGrid
          failures={[
            makeFailure({
              issues: [
                {
                  kind: 'format',
                  fields: ['amount'],
                  message: 'Invalid amount format',
                },
              ],
              existingTransaction: undefined,
            }),
          ]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
          accounts={[{ id: 'acct-1', name: 'Savings Account' }]}
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('shows multiple dropdowns when multiple entities are missing', () => {
      render(
        <FailedTransactionsGrid
          failures={[
            makeFailure({
              issues: [
                {
                  kind: 'entity',
                  fields: ['account'],
                  message: 'Account "Chase Checking" not found',
                },
                {
                  kind: 'entity',
                  fields: ['category'],
                  message: 'Category "Food" not found',
                },
                {
                  kind: 'entity',
                  fields: ['type'],
                  message: 'Type "Purchase" not found',
                },
              ],
              existingTransaction: undefined,
            }),
          ]}
          householdId={HOUSEHOLD_ID}
          mode="preview"
          accounts={[{ id: 'acct-1', name: 'Savings Account' }]}
          categories={[{ id: 'cat-1', name: 'Food' }]}
          types={[{ id: 'type-1', name: 'Purchase' }]}
        />
      )

      fireEvent.click(screen.getByLabelText('Expand details'))

      expect(screen.getAllByRole('combobox')).toHaveLength(3)
    })
  })
})
