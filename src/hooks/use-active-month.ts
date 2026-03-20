import { useState, useEffect } from 'react'
import { currentMonth, currentYear, monthName } from '@/lib/date-utils'
import { apiFetch } from '@/lib/http-utils'

interface ActiveMonthData {
  year: number
  month: number
  monthName: string
  isCurrentMonth: boolean
  uniqueDays?: number
  message?: string
}

interface UseActiveMonthReturn {
  activeYear: number | null
  activeMonth: number | null
  monthName: string | null
  isCurrentMonth: boolean
  loading: boolean
  error: Error | null
  refetch: () => void
}

const CACHE_TTL_MS = 5 * 60 * 1000

// Cache for active month data per household
const activeMonthCache = new Map<string, { data: ActiveMonthData; expiresAt: number }>()

export function useActiveMonth(householdId: string | null): UseActiveMonthReturn {
  const [data, setData] = useState<ActiveMonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchActiveMonth = async () => {
    if (!householdId) {
      setLoading(false)
      return
    }

    // Check cache first
    const cached = activeMonthCache.get(householdId)
    if (cached && Date.now() < cached.expiresAt) {
      setData(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: result, error } = await apiFetch<ActiveMonthData>(
      `/api/households/${householdId}/active-month`,
      {
        showErrorToast: false, // Don't show toast for this background operation
        showRateLimitToast: true, // Show rate limit toasts
      }
    )

    if (result) {
      // Cache the result
      activeMonthCache.set(householdId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
      setData(result)
    } else if (error) {
      console.error('Error fetching active month:', error)
      setError(new Error(error))

      // Fallback to current month if API fails
      const fallbackData: ActiveMonthData = {
        year: currentYear(),
        month: currentMonth(),
        monthName: monthName(currentMonth()),
        isCurrentMonth: true,
        message: 'Using current month (API failed)',
      }

      setData(fallbackData)

      // Cache the fallback for this session
      activeMonthCache.set(householdId, {
        data: fallbackData,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
    }

    setLoading(false)
  }

  // Function to invalidate cache and refetch
  const refetch = () => {
    if (householdId) {
      activeMonthCache.delete(householdId)
      fetchActiveMonth()
    }
  }

  useEffect(() => {
    fetchActiveMonth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  return {
    activeYear: data?.year ?? null,
    activeMonth: data?.month ?? null,
    monthName: data?.monthName ?? null,
    isCurrentMonth: data?.isCurrentMonth ?? true,
    loading,
    error,
    refetch,
  }
}

// Function to invalidate cache for a specific household
export function invalidateActiveMonthCache(householdId: string) {
  activeMonthCache.delete(householdId)
}

// Function to clear entire cache
export function clearActiveMonthCache() {
  activeMonthCache.clear()
}
