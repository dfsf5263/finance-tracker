'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

interface DbUser {
  id: string
  clerkUserId: string
  email: string
  firstName?: string
  lastName?: string
}

export function useDbUser() {
  const { user: clerkUser, isLoaded } = useUser()
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDbUser() {
      if (!isLoaded || !clerkUser) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/users/current')
        if (response.ok) {
          const userData = await response.json()
          setDbUser(userData)
        } else {
          const errorData = await response.json()
          setError(errorData.error || 'Failed to fetch user data')
        }
      } catch (err) {
        console.error('Error fetching database user:', err)
        setError('Failed to fetch user data')
      } finally {
        setLoading(false)
      }
    }

    fetchDbUser()
  }, [clerkUser, isLoaded])

  return {
    dbUser,
    loading,
    error,
    isLoaded: isLoaded && !loading,
  }
}
