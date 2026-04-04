import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAbortController } from '@/hooks/useAbortController'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAbortController', () => {
  it('returns a getSignal function', () => {
    const { result } = renderHook(() => useAbortController())
    expect(typeof result.current.getSignal).toBe('function')
  })

  it('returns a valid AbortSignal', () => {
    const { result } = renderHook(() => useAbortController())

    let signal: AbortSignal
    act(() => {
      signal = result.current.getSignal()
    })

    expect(signal!).toBeInstanceOf(AbortSignal)
    expect(signal!.aborted).toBe(false)
  })

  it('aborts the previous signal when getSignal is called again', () => {
    const { result } = renderHook(() => useAbortController())

    let first: AbortSignal
    let second: AbortSignal
    act(() => {
      first = result.current.getSignal()
    })
    act(() => {
      second = result.current.getSignal()
    })

    expect(first!.aborted).toBe(true)
    expect(second!.aborted).toBe(false)
  })

  it('aborts the active signal on unmount', () => {
    const { result, unmount } = renderHook(() => useAbortController())

    let signal: AbortSignal
    act(() => {
      signal = result.current.getSignal()
    })

    expect(signal!.aborted).toBe(false)
    unmount()
    expect(signal!.aborted).toBe(true)
  })

  it('returns a stable getSignal reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useAbortController())
    const first = result.current.getSignal
    rerender()
    expect(result.current.getSignal).toBe(first)
  })
})
