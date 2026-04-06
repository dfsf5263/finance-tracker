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
    expect(global.fetch).toHaveBeenCalledWith('/api/instance-settings', expect.any(Object))
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

  it('returns cached settings immediately without refetching', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ emailEnabled: false, signupsEnabled: false }), { status: 200 })
    )

    const mod = await import('./useInstanceSettings')
    // First render populates the cache
    const { result: first } = renderHook(() => mod.useInstanceSettings())
    await waitFor(() => {
      expect(first.current.isLoading).toBe(false)
    })
    expect(first.current.emailEnabled).toBe(false)

    // Second render should use cached data and not refetch
    const { result: second } = renderHook(() => mod.useInstanceSettings())
    expect(second.current.isLoading).toBe(false)
    expect(second.current.emailEnabled).toBe(false)
    expect(second.current.signupsEnabled).toBe(false)
    // Only one fetch call for both renders
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent fetches', async () => {
    let resolveResponse: (value: Response) => void
    vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve
        })
    )

    const mod = await import('./useInstanceSettings')
    // Render two hooks concurrently while the fetch is still in-flight
    const { result: first } = renderHook(() => mod.useInstanceSettings())
    const { result: second } = renderHook(() => mod.useInstanceSettings())

    expect(first.current.isLoading).toBe(true)
    expect(second.current.isLoading).toBe(true)

    // Resolve the single fetch
    resolveResponse!(
      new Response(JSON.stringify({ emailEnabled: false, signupsEnabled: true }), { status: 200 })
    )

    await waitFor(() => {
      expect(first.current.isLoading).toBe(false)
    })
    await waitFor(() => {
      expect(second.current.isLoading).toBe(false)
    })

    expect(first.current.emailEnabled).toBe(false)
    expect(second.current.signupsEnabled).toBe(true)
    // Only one fetch despite two concurrent hooks
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('allows retry after fetch error by clearing fetchPromise', async () => {
    // First call fails
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const mod = await import('./useInstanceSettings')
    const { result: first } = renderHook(() => mod.useInstanceSettings())
    await waitFor(() => {
      expect(first.current.isLoading).toBe(false)
    })
    // Got defaults due to error
    expect(first.current.emailEnabled).toBe(true)

    // Second call succeeds — fetchPromise was cleared so a new fetch occurs
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ emailEnabled: false, signupsEnabled: false }), { status: 200 })
    )

    // Re-render triggers a new fetch because fetchPromise was nulled on error
    const { result: second } = renderHook(() => mod.useInstanceSettings())
    await waitFor(() => {
      expect(second.current.isLoading).toBe(false)
    })
    expect(second.current.emailEnabled).toBe(false)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
