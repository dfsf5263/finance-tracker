'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, Clock } from 'lucide-react'
import {
  SESSION_CONFIG,
  shouldShowWarning,
  isSessionExpired,
  getTimeUntilTimeout,
  formatTimeRemaining,
} from '@/lib/session-config'

export function SessionMonitor() {
  const router = useRouter()
  const { isLoaded, isSignedIn, signOut } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Update last activity time
  const updateActivity = useCallback(() => {
    const now = Date.now()
    setLastActivity(now)
    // Store in localStorage for cross-tab synchronization
    localStorage.setItem(SESSION_CONFIG.LAST_ACTIVITY_KEY, now.toString())
    // Hide warning if user becomes active
    if (showWarning) {
      setShowWarning(false)
    }
  }, [showWarning])

  // Handle session expiry
  const handleSessionExpired = useCallback(async () => {
    // Clear intervals
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    // Sign out and redirect
    await signOut()
    router.push('/sign-in?message=session_expired')
  }, [signOut, router])

  // Check session status
  const checkSession = useCallback(() => {
    // Get last activity from localStorage (for cross-tab sync)
    const storedActivity = localStorage.getItem(SESSION_CONFIG.LAST_ACTIVITY_KEY)
    const lastActivityTime = storedActivity ? parseInt(storedActivity) : lastActivity

    if (isSessionExpired(lastActivityTime)) {
      handleSessionExpired()
    } else if (shouldShowWarning(lastActivityTime) && !showWarning) {
      setShowWarning(true)
      setTimeRemaining(getTimeUntilTimeout(lastActivityTime))
    }
  }, [lastActivity, showWarning, handleSessionExpired])

  // Handle warning dialog actions
  const handleStayLoggedIn = useCallback(() => {
    updateActivity()
    setShowWarning(false)
  }, [updateActivity])

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)
      await signOut()
      router.push('/sign-in')
    } catch (error) {
      console.error('Error during logout:', error)
      setIsLoggingOut(false)
    }
  }, [signOut, router])

  // Set up activity tracking
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    // Initial delay before starting tracking
    const initialTimer = setTimeout(() => {
      // Add activity event listeners
      const activityHandler = () => updateActivity()

      SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
        window.addEventListener(event, activityHandler)
      })

      // Set up session check interval
      checkIntervalRef.current = setInterval(
        checkSession,
        SESSION_CONFIG.CHECK_INTERVAL_SECONDS * 1000
      )

      // Cleanup function
      return () => {
        SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
          window.removeEventListener(event, activityHandler)
        })

        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
        }
      }
    }, SESSION_CONFIG.INITIAL_DELAY_SECONDS * 1000)

    return () => clearTimeout(initialTimer)
  }, [isLoaded, isSignedIn, updateActivity, checkSession])

  // Countdown timer for warning modal
  useEffect(() => {
    if (showWarning && timeRemaining > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1000
          if (newTime <= 0) {
            handleSessionExpired()
            return 0
          }
          return newTime
        })
      }, 1000)

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
        }
      }
    }
  }, [showWarning, timeRemaining, handleSessionExpired])

  // Listen for storage events (cross-tab activity sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_CONFIG.LAST_ACTIVITY_KEY && e.newValue) {
        setLastActivity(parseInt(e.newValue))
        // Hide warning if activity detected in another tab
        if (showWarning) {
          setShowWarning(false)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [showWarning])

  // Handle dialog open/close changes - prevent closing during logout
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!isLoggingOut) {
        setShowWarning(open)
      }
    },
    [isLoggingOut]
  )

  // Don't render anything if not authenticated
  if (!isLoaded || !isSignedIn) return null

  return (
    <Dialog open={showWarning} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Session Timeout Warning
          </DialogTitle>
          <div className="pt-3 space-y-3 text-muted-foreground text-sm">
            <div>Your session will expire due to inactivity in:</div>
            <div className="flex items-center justify-center gap-2 py-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-semibold">{formatTimeRemaining(timeRemaining)}</span>
            </div>
            <div className="text-sm">
              Click &quot;Stay Logged In&quot; to continue your session, or &quot;Log Out&quot; to
              securely end your session now.
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Logging out...' : 'Log Out'}
          </Button>
          <Button onClick={handleStayLoggedIn} autoFocus disabled={isLoggingOut}>
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
