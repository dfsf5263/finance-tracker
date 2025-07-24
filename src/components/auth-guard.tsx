'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()

  useEffect(() => {
    // If we're done loading and there's no session, redirect to sign-in
    if (!isPending && !session) {
      router.push('/sign-in')
    }
  }, [session, isPending, router])

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If no session, don't render children (redirect will happen via useEffect)
  if (!session) {
    return null
  }

  // Session is valid, render the protected content
  return <>{children}</>
}
