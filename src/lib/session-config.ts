/**
 * Session configuration constants
 *
 * These values should match the settings configured in the Clerk Dashboard.
 * See docs/SESSION_CONFIGURATION.md for setup instructions.
 */

export const SESSION_CONFIG = {
  /**
   * Time in minutes before inactivity timeout to show warning
   * Example: If timeout is 30 min, warning shows at 25 min
   */
  INACTIVITY_WARNING_MINUTES: 5,

  /**
   * Expected inactivity timeout in minutes (configured in Clerk)
   * Used for client-side calculations only
   */
  INACTIVITY_TIMEOUT_MINUTES: 30,

  /**
   * Buffer time in seconds to account for network delays and clock differences
   * This prevents premature warnings due to slight timing mismatches
   */
  BUFFER_SECONDS: 30,

  /**
   * Maximum session lifetime in hours (configured in Clerk)
   * Used for client-side calculations only
   */
  MAX_SESSION_HOURS: 8,

  /**
   * Browser events that indicate user activity
   */
  ACTIVITY_EVENTS: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const,

  /**
   * How often to check session status (in seconds)
   * Fixed interval for simple and reliable monitoring
   */
  FIXED_CHECK_INTERVAL_SECONDS: 30,

  /**
   * Delay before starting activity tracking (in seconds)
   * Prevents immediate tracking during page load
   */
  INITIAL_DELAY_SECONDS: 5,

  /**
   * Local storage key for tracking last activity
   */
  LAST_ACTIVITY_KEY: 'finance_tracker_last_activity',

  /**
   * Warning modal auto-close timeout (in seconds)
   * If user doesn't respond to warning, modal closes and logout proceeds
   */
  WARNING_MODAL_TIMEOUT_SECONDS: 300, // 5 minutes
} as const

/**
 * Calculate milliseconds from minutes
 */
export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000
}

/**
 * Calculate milliseconds from hours
 */
export function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000
}

/**
 * Format remaining time for display
 */
export function formatTimeRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)

  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`
  }

  return `${seconds} second${seconds !== 1 ? 's' : ''}`
}

/**
 * Check if we should show the inactivity warning
 */
export function shouldShowWarning(lastActivityTime: number): boolean {
  const now = Date.now()
  const timeSinceActivity = now - lastActivityTime
  // Show warning when: (timeout - warning) minutes have passed
  // For 2 min timeout, 1 min warning: show after 1 minute of inactivity
  const warningThreshold = minutesToMs(
    SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES - SESSION_CONFIG.INACTIVITY_WARNING_MINUTES
  )
  const timeoutThreshold = minutesToMs(SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES)

  return timeSinceActivity >= warningThreshold && timeSinceActivity < timeoutThreshold
}

/**
 * Check if session should be considered expired due to inactivity
 */
export function isSessionExpired(lastActivityTime: number): boolean {
  const now = Date.now()
  const timeSinceActivity = now - lastActivityTime
  // Session expires after the full timeout period
  const timeoutThreshold = minutesToMs(SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES)

  return timeSinceActivity >= timeoutThreshold
}

/**
 * Get remaining time before timeout
 */
export function getTimeUntilTimeout(lastActivityTime: number): number {
  const now = Date.now()
  const timeSinceActivity = now - lastActivityTime
  const timeoutThreshold = minutesToMs(SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES)

  return Math.max(0, timeoutThreshold - timeSinceActivity)
}
