import { NextRequest } from 'next/server'

interface LogApiErrorOptions {
  request: NextRequest
  error: unknown
  context?: Record<string, unknown>
  operation?: string
}

/**
 * Logs API errors with detailed request context, following the pattern established
 * in the webhook API for consistent error logging across all API routes.
 */
export async function logApiError({ request, error, context, operation }: LogApiErrorOptions) {
  try {
    console.error('=== API Error ===')
    console.error('Timestamp:', new Date().toISOString())
    console.error('Method:', request.method)
    console.error('URL:', request.url)

    if (operation) {
      console.error('Operation:', operation)
    }

    // Log request headers (sanitized)
    const headers = Object.fromEntries(request.headers.entries())
    const sanitizedHeaders = sanitizeHeaders(headers)
    console.error('Headers:', JSON.stringify(sanitizedHeaders, null, 2))

    // Log request body if present (sanitized)
    try {
      const body = await getRequestBody(request)
      if (body) {
        const sanitizedBody = sanitizeRequestData(body)
        console.error('Request Body:', JSON.stringify(sanitizedBody, null, 2))
      }
    } catch (bodyError) {
      console.error('Could not read request body:', bodyError)
    }

    // Log additional context if provided
    if (context) {
      const sanitizedContext = sanitizeRequestData(context)
      console.error('Context:', JSON.stringify(sanitizedContext, null, 2))
    }

    // Log error details
    console.error('Error:', error)

    // Log error code if available (Prisma errors)
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Error Code:', error.code)
    }

    // Log error meta if available (Prisma errors)
    if (error && typeof error === 'object' && 'meta' in error) {
      console.error('Error Meta:', error.meta)
    }

    // Log stack trace if available
    if (error instanceof Error && error.stack) {
      console.error('Stack Trace:', error.stack)
    }
  } catch (loggingError) {
    // Fallback logging if the detailed logging fails
    console.error('Error logging failed:', loggingError)
    console.error('Original error:', error)
  }
}

/**
 * Attempts to read the request body, handling the case where it may have already been consumed
 */
async function getRequestBody(request: NextRequest): Promise<unknown> {
  try {
    // Clone the request to avoid consuming the original body
    const clonedRequest = request.clone()
    const contentType = clonedRequest.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return await clonedRequest.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await clonedRequest.formData()
      return Object.fromEntries(formData.entries())
    } else if (contentType.includes('text/')) {
      return await clonedRequest.text()
    }

    return null
  } catch {
    // If we can't read the body, return null
    return null
  }
}

/**
 * Sanitizes request data by removing or masking sensitive information
 */
function sanitizeRequestData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'authorization',
    'auth',
    'key',
    'apikey',
    'api_key',
    'access_token',
    'refresh_token',
    'clerk_user_id',
    'svix-signature',
    'svix-id',
    'svix-timestamp',
  ]

  const sanitized: Record<string, unknown> | unknown[] = Array.isArray(data) ? [] : {}

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase()
    const isSensitive = sensitiveKeys.some((sensitiveKey) => keyLower.includes(sensitiveKey))

    if (isSensitive) {
      // Mask sensitive data
      if (typeof value === 'string' && value.length > 0) {
        ;(sanitized as Record<string, unknown>)[key] =
          `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
      } else {
        ;(sanitized as Record<string, unknown>)[key] = '***'
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      ;(sanitized as Record<string, unknown>)[key] = sanitizeRequestData(value)
    } else {
      ;(sanitized as Record<string, unknown>)[key] = value
    }
  }

  return sanitized
}

/**
 * Sanitizes headers by removing or masking sensitive information
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase()

    if (
      keyLower.includes('authorization') ||
      keyLower.includes('token') ||
      keyLower.includes('secret') ||
      keyLower.includes('svix-signature')
    ) {
      sanitized[key] = value
        ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
        : '***'
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
