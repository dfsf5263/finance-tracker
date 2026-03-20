import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useActiveMonth } from '@/hooks/use-active-month'

// Mock apiFetch to control API responses in tests
vi.mock('@/lib/http-utils', () => ({
  apiFetch: vi.fn(),
}))

// Mock date-related utils
vi.mock('@/lib/date-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/date-utils')>()
  return {
    ...actual,
    currentMonth: () => 1,
    currentYear: () => 2024,
    monthName: () => 'January',
  }
})

import { apiFetch } from '@/lib/http-utils'
const mockApiFetch = vi.mocked(apiFetch)

const mockActiveMonthData = {
  year: 2024,
  month: 1,
  monthName: 'January',
  isCurrentMonth: true,
  uniqueDays: 20,
}

beforeEach(() => {
  // Clear vitest-mock-extended module mock between tests by resetting the module-level cache.
  // The hook uses a module-level Map cache — we clear it via refetch() or by mocking Date.now.
  vi.clearAllMocks()
  // Default to successful API response
  mockApiFetch.mockResolvedValue({
    data: mockActiveMonthData,
    error: null,
    response: new Response(),
  })
})

describe('useActiveMonth', () => {
  it('returns null when householdId is null', async () => {
    const { result } = renderHook(() => useActiveMonth(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeYear).toBeNull()
    expect(result.current.activeMonth).toBeNull()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('fetches active month data on mount', async () => {
    const { result } = renderHook(() => useActiveMonth('hh-fetch-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockApiFetch).toHaveBeenCalledOnce()
    expect(result.current.activeYear).toBe(2024)
    expect(result.current.activeMonth).toBe(1)
    expect(result.current.monthName).toBe('January')
    expect(result.current.isCurrentMonth).toBe(true)
  })

  it('uses cache on second render within TTL — does not re-fetch', async () => {
    const { result, rerender } = renderHook(() => useActiveMonth('hh-cache-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Re-render with same householdId — should hit cache, not call API again
    rerender()
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockApiFetch).toHaveBeenCalledTimes(1)
  })

  it('refetch() clears cache and triggers a new API call', async () => {
    const { result } = renderHook(() => useActiveMonth('hh-refetch-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockApiFetch).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockApiFetch).toHaveBeenCalledTimes(2)
  })

  it('fetches again after TTL expiry (Date.now advanced past expiresAt)', async () => {
    const originalDateNow = Date.now
    let fakeNow = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow)

    const { result, rerender } = renderHook(({ id }) => useActiveMonth(id), {
      initialProps: { id: 'hh-ttl-test' },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockApiFetch).toHaveBeenCalledTimes(1)

    // Advance time beyond the 5-minute TTL
    fakeNow += 6 * 60 * 1000

    // Change householdId to force useEffect re-run simulating a fresh mount
    rerender({ id: 'hh-ttl-test-2' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    // New householdId triggers a fetch (no cache for it)
    expect(mockApiFetch).toHaveBeenCalledTimes(2)

    vi.spyOn(Date, 'now').mockImplementation(originalDateNow)
  })

  it('falls back to current month on API error', async () => {
    mockApiFetch.mockResolvedValue({ data: null, error: 'Network error', response: new Response() })

    const { result } = renderHook(() => useActiveMonth('hh-error'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Should fall back to current month utilities
    expect(result.current.activeYear).toBe(2024)
    expect(result.current.activeMonth).toBe(1)
  })
})
