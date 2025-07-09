import { useState, useEffect, useCallback } from 'react'

interface EntityCounts {
  categories: number
  users: number
  accounts: number
  types: number
}

interface UseEntityCountsReturn {
  counts: EntityCounts
  isLoading: boolean
  error: string | null
  refreshCounts: () => void
}

export function useEntityCounts(householdId?: string): UseEntityCountsReturn {
  const [counts, setCounts] = useState<EntityCounts>({
    categories: 0,
    users: 0,
    accounts: 0,
    types: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEntityCounts = useCallback(async () => {
    if (!householdId) {
      setCounts({ categories: 0, users: 0, accounts: 0, types: 0 })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const endpoints = [
        `/api/categories?householdId=${householdId}`,
        `/api/users?householdId=${householdId}`,
        `/api/accounts?householdId=${householdId}`,
        `/api/types?householdId=${householdId}`,
      ]

      const responses = await Promise.all(endpoints.map((endpoint) => fetch(endpoint)))

      // Check if all requests were successful
      const failedResponse = responses.find((response) => !response.ok)
      if (failedResponse) {
        throw new Error(`Failed to fetch entity counts: ${failedResponse.status}`)
      }

      const data = await Promise.all(responses.map((response) => response.json()))

      setCounts({
        categories: data[0]?.length || 0,
        users: data[1]?.length || 0,
        accounts: data[2]?.length || 0,
        types: data[3]?.length || 0,
      })
    } catch (err) {
      console.error('Error fetching entity counts:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [householdId])

  const refreshCounts = () => {
    fetchEntityCounts()
  }

  useEffect(() => {
    fetchEntityCounts()
  }, [householdId, fetchEntityCounts])

  return {
    counts,
    isLoading,
    error,
    refreshCounts,
  }
}
