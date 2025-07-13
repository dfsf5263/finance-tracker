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
  // We don't need Clerk's session data for client-side timeout
  // const { session } = useSession()
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)

  // Debug mode from environment
  const debugMode =
    process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_SESSION === 'true'

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debugMode) {
        console.log(`[SessionMonitor] ${message}`, data || '')
      }
    },
    [debugMode]
  )

  // Update last activity time
  const updateActivity = useCallback(() => {
    const now = Date.now()
    setLastActivity(now)
    log('Activity detected', { time: new Date(now).toISOString() })

    // Store in localStorage for cross-tab synchronization
    try {
      localStorage.setItem(SESSION_CONFIG.LAST_ACTIVITY_KEY, now.toString())

      // Broadcast activity to other tabs
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'activity', time: now })
      }
    } catch (error) {
      console.error('[SessionMonitor] Failed to update activity in localStorage:', error)
    }

    // Hide warning if user becomes active
    if (showWarning) {
      setShowWarning(false)
      log('Warning hidden due to activity')
    }
  }, [showWarning, log])

  // Handle session expiry
  const handleSessionExpired = useCallback(async () => {
    log('Session expired, initiating logout')

    // Prevent multiple logout attempts
    if (isLoggingOut) {
      log('Already logging out, skipping')
      return
    }

    setIsLoggingOut(true)

    // Clear intervals
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    try {
      // Sign out and redirect
      await signOut()
      router.push('/sign-in?message=session_expired')
    } catch (error) {
      console.error('[SessionMonitor] Error during session expiry logout:', error)
      // Force redirect even if signOut fails
      router.push('/sign-in?message=session_expired')
    }
  }, [signOut, router, isLoggingOut, log])

  // Check session status
  const checkSession = useCallback(() => {
    // Get last activity from localStorage (for cross-tab sync)
    let lastActivityTime = lastActivity
    try {
      const storedActivity = localStorage.getItem(SESSION_CONFIG.LAST_ACTIVITY_KEY)
      if (storedActivity) {
        const storedTime = parseInt(storedActivity)
        if (!isNaN(storedTime)) {
          lastActivityTime = storedTime
        }
      }
    } catch (error) {
      console.error('[SessionMonitor] Failed to read activity from localStorage:', error)
    }

    const timeSinceActivity = Date.now() - lastActivityTime
    log('Checking session', {
      lastActivity: new Date(lastActivityTime).toISOString(),
      timeSinceActivity: Math.floor(timeSinceActivity / 1000) + 's',
      warningThreshold:
        SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES -
        SESSION_CONFIG.INACTIVITY_WARNING_MINUTES +
        ' min',
      timeoutThreshold: SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES + ' min',
    })

    if (isSessionExpired(lastActivityTime)) {
      log('Session expired due to inactivity')
      handleSessionExpired()
    } else if (shouldShowWarning(lastActivityTime) && !showWarning && !isLoggingOut) {
      log('Showing inactivity warning')
      setShowWarning(true)
      setTimeRemaining(getTimeUntilTimeout(lastActivityTime))
    }
  }, [lastActivity, showWarning, handleSessionExpired, isLoggingOut, log])

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

    let mounted = true
    log('Setting up session monitor')

    // Add activity event listeners immediately (no delay)
    const activityHandler = () => {
      if (mounted && isInitialized) {
        updateActivity()
      }
    }

    SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, activityHandler)
    })

    // Set up BroadcastChannel for cross-tab communication
    try {
      broadcastChannelRef.current = new BroadcastChannel('session_monitor')
      broadcastChannelRef.current.onmessage = (event) => {
        if (mounted && event.data.type === 'activity' && event.data.time) {
          log('Activity received from another tab', {
            time: new Date(event.data.time).toISOString(),
          })
          setLastActivity(event.data.time)
          if (showWarning) {
            setShowWarning(false)
          }
        }
      }
    } catch {
      log('BroadcastChannel not supported, falling back to localStorage only')
    }

    // Initialize activity tracking after a short delay to avoid initial false positives
    const initTimer = setTimeout(() => {
      if (mounted) {
        setIsInitialized(true)
        updateActivity() // Record initial activity

        // Set up session check interval
        checkIntervalRef.current = setInterval(
          checkSession,
          SESSION_CONFIG.FIXED_CHECK_INTERVAL_SECONDS * 1000
        )

        log('Session monitor initialized', {
          checkInterval: SESSION_CONFIG.FIXED_CHECK_INTERVAL_SECONDS + 's',
          warningAfter:
            SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES -
            SESSION_CONFIG.INACTIVITY_WARNING_MINUTES +
            ' min',
          timeoutAfter: SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES + ' min',
        })
      }
    }, 1000) // 1 second delay

    // Cleanup function
    return () => {
      mounted = false
      clearTimeout(initTimer)

      SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, activityHandler)
      })

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close()
        broadcastChannelRef.current = null
      }

      log('Session monitor cleaned up')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]) // Minimal dependencies to prevent re-initialization

  // Countdown timer for warning modal
  useEffect(() => {
    if (showWarning && timeRemaining > 0 && !isLoggingOut) {
      log('Starting countdown timer', { timeRemaining: formatTimeRemaining(timeRemaining) })

      countdownIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1000
          if (newTime <= 0) {
            log('Countdown reached zero')
            handleSessionExpired()
            return 0
          }
          return newTime
        })
      }, 1000)

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
      }
    }
  }, [showWarning, timeRemaining, handleSessionExpired, isLoggingOut, log])

  // Listen for storage events (cross-tab activity sync fallback)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_CONFIG.LAST_ACTIVITY_KEY && e.newValue) {
        try {
          const newActivityTime = parseInt(e.newValue)
          if (!isNaN(newActivityTime)) {
            log('Activity sync from storage event', {
              time: new Date(newActivityTime).toISOString(),
            })
            setLastActivity(newActivityTime)
            // Hide warning if activity detected in another tab
            if (showWarning && !isLoggingOut) {
              setShowWarning(false)
            }
          }
        } catch (error) {
          console.error('[SessionMonitor] Failed to parse activity time from storage:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [showWarning, isLoggingOut, log])

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
