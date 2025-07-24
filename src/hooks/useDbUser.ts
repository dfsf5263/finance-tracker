'use client'

import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

interface DbUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  emailVerified: boolean
  twoFactorEnabled?: boolean
}

export function useDbUser() {
  const { data: session, isPending } = authClient.useSession()
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDbUser() {
      if (isPending) {
        return
      }

      if (!session?.user) {
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
  }, [session, isPending])

  return {
    dbUser,
    loading,
    error,
    isLoaded: !isPending && !loading,
  }
}
