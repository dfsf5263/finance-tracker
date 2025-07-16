import { toast } from 'sonner'

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
  retryAfter?: number
  validationErrors?: Array<{
    row: number
    field: string
    value: string
    message: string
  }>
  details?: unknown
}

export interface FetchOptions extends RequestInit {
  showErrorToast?: boolean
  showRateLimitToast?: boolean
}

/**
 * Enhanced fetch wrapper with consistent error handling and rate limiting support
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null; response: Response; errorData?: unknown }> {
  const { showErrorToast = true, showRateLimitToast = true, ...fetchOptions } = options

  try {
    const response = await fetch(url, fetchOptions)

    // Handle rate limiting (429 status)
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}))
      const retryAfter = response.headers.get('Retry-After')
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter) : errorData.retryAfter || 60

      const retryMessage =
        retryAfterSeconds > 0
          ? ` Please try again in ${retryAfterSeconds} seconds.`
          : ' Please try again later.'

      const errorMessage = errorData.error || 'Rate limit exceeded.'
      const fullMessage = errorMessage + retryMessage

      if (showRateLimitToast) {
        toast.error(fullMessage, {
          duration: Math.min(retryAfterSeconds * 1000, 10000), // Max 10 seconds
        })
      }

      return {
        data: null,
        error: fullMessage,
        response,
        errorData,
      }
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage =
        errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`

      if (showErrorToast) {
        toast.error(errorMessage)
      }

      return {
        data: null,
        error: errorMessage,
        response,
        errorData,
      }
    }

    // Success case
    const data = await response.json()
    return {
      data,
      error: null,
      response,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error occurred'

    if (showErrorToast) {
      toast.error(errorMessage)
    }

    return {
      data: null,
      error: errorMessage,
      response: new Response(null, { status: 0 }),
      errorData: undefined,
    }
  }
}

/**
 * Specific helper for rate limit aware API calls
 */
export async function rateAwareApiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null; isRateLimited: boolean; errorData?: unknown }> {
  const result = await apiFetch<T>(url, options)

  return {
    data: result.data,
    error: result.error,
    isRateLimited: result.response.status === 429,
    errorData: result.errorData,
  }
}

/**
 * Helper to extract retry-after information from rate limit errors
 */
export function parseRetryAfter(error: string): number | null {
  const match = error.match(/try again in (\d+) seconds/)
  return match ? parseInt(match[1]) : null
}
