import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Reset the module-level cache between tests by re-importing
beforeEach(() => {
  vi.clearAllMocks()
  // Reset module cache to clear cachedSettings and fetchPromise
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useInstanceSettings', () => {
  it('returns defaults while loading', async () => {
    // Delay fetch to observe loading state
    vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ emailEnabled: false, signupsEnabled: false }), {
                  status: 200,
                })
              ),
            100
          )
        )
    )

    const { useInstanceSettings: freshHook } = await import('./useInstanceSettings')
    const { result } = renderHook(() => freshHook())

    // Initially should have defaults
    expect(result.current.emailEnabled).toBe(true)
    expect(result.current.signupsEnabled).toBe(true)
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.emailEnabled).toBe(false)
    expect(result.current.signupsEnabled).toBe(false)
  })

  it('fetches settings from the API', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ emailEnabled: true, signupsEnabled: false }), { status: 200 })
    )

    const { useInstanceSettings: freshHook } = await import('./useInstanceSettings')
    const { result } = renderHook(() => freshHook())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.emailEnabled).toBe(true)
    expect(result.current.signupsEnabled).toBe(false)
    expect(global.fetch).toHaveBeenCalledWith('/api/instance-settings')
  })

  it('falls back to defaults on fetch error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    const { useInstanceSettings: freshHook } = await import('./useInstanceSettings')
    const { result } = renderHook(() => freshHook())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.emailEnabled).toBe(true)
    expect(result.current.signupsEnabled).toBe(true)
  })

  it('falls back to defaults on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('Server Error', { status: 500 }))

    const { useInstanceSettings: freshHook } = await import('./useInstanceSettings')
    const { result } = renderHook(() => freshHook())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.emailEnabled).toBe(true)
    expect(result.current.signupsEnabled).toBe(true)
  })
})
