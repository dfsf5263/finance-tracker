import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/http-utils', () => ({ apiFetch: mockApiFetch }))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { toast } from 'sonner'

const mockCanManageData = vi.hoisted(() => vi.fn())
vi.mock('@/lib/role-utils', () => ({ canManageData: mockCanManageData }))

vi.mock('@/hooks/use-active-month', () => ({
  invalidateActiveMonthCache: vi.fn(),
}))
import { invalidateActiveMonthCache } from '@/hooks/use-active-month'

import { useCRUD } from '@/hooks/useCRUD'

type Item = { id: string; name: string }

function mockSuccess<T>(data: T) {
  return { data, error: null, response: new Response(null, { status: 200 }) }
}

function mockError(error: string) {
  return { data: null, error, response: new Response(null, { status: 400 }) }
}

function makeItem(id = '1'): Item {
  return { id, name: `Item ${id}` }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCanManageData.mockReturnValue(true)
  mockApiFetch.mockResolvedValue(mockSuccess<Item[]>([makeItem('1'), makeItem('2')]))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useCRUD', () => {
  describe('fetchItems', () => {
    it('fetches items on mount', async () => {
      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))

      await waitFor(() => {
        expect(result.current.items).toHaveLength(2)
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/accounts?householdId=hh-1',
        expect.objectContaining({ showErrorToast: false })
      )
    })

    it('fetches without householdId when not provided', async () => {
      renderHook(() => useCRUD<Item>('accounts', 'Account'))

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/accounts', expect.anything())
      })
    })
  })

  describe('handleCreate', () => {
    it('shows permission error when canManageData returns false', async () => {
      mockCanManageData.mockReturnValue(false)
      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'VIEWER'))

      await act(async () => {
        await result.current.handleCreate({ name: 'New Account' } as Omit<Item, 'id'>)
      })

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('permission'))
      expect(mockApiFetch).toHaveBeenCalledTimes(1) // only the initial fetch, not the create
    })

    it('POSTs to create endpoint and shows success toast', async () => {
      mockApiFetch
        .mockResolvedValueOnce(mockSuccess<Item[]>([])) // initial fetch
        .mockResolvedValueOnce(mockSuccess<Item>({ id: '3', name: 'New' })) // POST
        .mockResolvedValueOnce(mockSuccess<Item[]>([{ id: '3', name: 'New' }])) // re-fetch

      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))

      await act(async () => {
        await result.current.handleCreate({ name: 'New' } as Omit<Item, 'id'>)
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/accounts',
        expect.objectContaining({ method: 'POST' })
      )
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Account created successfully')
    })

    it('PUTs to update endpoint when editingItem is set', async () => {
      const existingItem = makeItem('5')

      mockApiFetch
        .mockResolvedValueOnce(mockSuccess<Item[]>([existingItem])) // initial fetch
        .mockResolvedValueOnce(mockSuccess<Item>({ ...existingItem, name: 'Updated' })) // PUT
        .mockResolvedValueOnce(mockSuccess<Item[]>([{ ...existingItem, name: 'Updated' }])) // re-fetch

      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))

      await waitFor(() => expect(result.current.items).toHaveLength(1))

      act(() => {
        result.current.handleEdit(existingItem)
      })

      await act(async () => {
        await result.current.handleCreate({ name: 'Updated' } as Omit<Item, 'id'>)
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/accounts/${existingItem.id}`,
        expect.objectContaining({ method: 'PUT' })
      )
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Account updated successfully')
    })

    it('shows error toast on create failure (non-rate-limit)', async () => {
      mockApiFetch
        .mockResolvedValueOnce(mockSuccess<Item[]>([]))
        .mockResolvedValueOnce(mockError('Server error'))

      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))

      await act(async () => {
        await result.current.handleCreate({ name: 'New' } as Omit<Item, 'id'>)
      })

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to create Account')
    })

    it('invalidates active month cache for transactions', async () => {
      mockApiFetch
        .mockResolvedValueOnce(mockSuccess<Item[]>([]))
        .mockResolvedValueOnce(mockSuccess<Item>({ id: 't1', name: 'txn' }))
        .mockResolvedValueOnce(mockSuccess<Item[]>([]))

      const { result } = renderHook(() =>
        useCRUD<Item>('transactions', 'Transaction', 'hh-1', 'OWNER')
      )

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))

      await act(async () => {
        await result.current.handleCreate({ name: 'txn' } as Omit<Item, 'id'>)
      })

      expect(vi.mocked(invalidateActiveMonthCache)).toHaveBeenCalledWith('hh-1')
    })
  })

  describe('handleEdit', () => {
    it('shows permission error when canManageData returns false', async () => {
      mockCanManageData.mockReturnValue(false)
      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'VIEWER'))

      act(() => {
        result.current.handleEdit(makeItem('1'))
      })

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('permission'))
      expect(result.current.formOpen).toBe(false)
    })

    it('sets editingItem and opens form when permitted', async () => {
      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))

      act(() => {
        result.current.handleEdit(makeItem('1'))
      })

      expect(result.current.editingItem).toEqual(makeItem('1'))
      expect(result.current.formOpen).toBe(true)
    })
  })

  describe('handleDelete', () => {
    it('shows permission error when canManageData returns false', async () => {
      mockCanManageData.mockReturnValue(false)
      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'VIEWER'))

      await act(async () => {
        await result.current.handleDelete('1')
      })

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('permission'))
    })

    it('DELETEs item and shows success toast', async () => {
      mockApiFetch
        .mockResolvedValueOnce(mockSuccess<Item[]>([makeItem('1')])) // initial fetch
        .mockResolvedValueOnce({
          data: null,
          error: null,
          response: new Response(null, { status: 204 }),
        }) // DELETE
        .mockResolvedValueOnce(mockSuccess<Item[]>([])) // re-fetch after delete

      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))

      await waitFor(() => expect(result.current.items).toHaveLength(1))

      await act(async () => {
        await result.current.handleDelete('1')
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/accounts/1',
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Account deleted successfully')
    })

    it('shows error toast on delete failure (non-rate-limit)', async () => {
      mockApiFetch
        .mockResolvedValueOnce(mockSuccess<Item[]>([makeItem('1')]))
        .mockResolvedValueOnce(mockError('Deletion failed'))

      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))

      await act(async () => {
        await result.current.handleDelete('1')
      })

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to delete Account')
    })
  })

  describe('canEdit', () => {
    it('returns true when canManageData returns true', () => {
      mockCanManageData.mockReturnValue(true)
      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'OWNER'))
      expect(result.current.canEdit).toBe(true)
    })

    it('returns false when canManageData returns false', () => {
      mockCanManageData.mockReturnValue(false)
      const { result } = renderHook(() => useCRUD<Item>('accounts', 'Account', 'hh-1', 'VIEWER'))
      expect(result.current.canEdit).toBe(false)
    })
  })
})
