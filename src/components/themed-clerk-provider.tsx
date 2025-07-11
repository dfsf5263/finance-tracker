'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface ThemedClerkProviderProps {
  children: React.ReactNode
}

export function ThemedClerkProvider({ children }: ThemedClerkProviderProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Ensure component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return <ClerkProvider>{children}</ClerkProvider>
  }

  // Determine if we should use dark theme
  // resolvedTheme accounts for 'system' preference
  const isDark = resolvedTheme === 'dark'

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,
        
        
      }}
    >
      {children}
    </ClerkProvider>
  )
}
