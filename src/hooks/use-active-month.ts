import { useState, useEffect } from 'react'
import { getCurrentMonth, getCurrentYear, getMonthName } from '@/lib/utils'

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

// Cache for active month data per household
const activeMonthCache = new Map<string, ActiveMonthData>()

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
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('Fetching active month for household:', householdId)
      const response = await fetch(`/api/households/${householdId}/active-month`)

      console.log('API response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API error response:', errorText)
        throw new Error(`API returned ${response.status}: ${errorText}`)
      }

      const result: ActiveMonthData = await response.json()
      console.log('Active month API result:', result)

      // Cache the result
      activeMonthCache.set(householdId, result)

      setData(result)
    } catch (err) {
      console.error('Error fetching active month:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))

      // Fallback to current month if API fails
      const fallbackData: ActiveMonthData = {
        year: getCurrentYear(),
        month: getCurrentMonth(),
        monthName: getMonthName(getCurrentMonth()),
        isCurrentMonth: true,
        message: 'Using current month (API failed)',
      }

      console.log('Using fallback data:', fallbackData)
      setData(fallbackData)

      // Cache the fallback for this session
      activeMonthCache.set(householdId, fallbackData)
    } finally {
      setLoading(false)
    }
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
