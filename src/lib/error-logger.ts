import { NextRequest } from 'next/server'
import logger from '@/lib/logger'

interface LogApiErrorOptions {
  request: NextRequest
  error: unknown
  context?: Record<string, unknown>
  operation?: string
}

export async function logApiError({ request, error, context, operation }: LogApiErrorOptions) {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    const body = await getRequestBody(request)
    const correlationId = request.headers.get('x-correlation-id')
    logger.error(
      {
        err,
        method: request.method,
        url: request.url,
        operation,
        correlationId,
        headers: sanitizeHeaders(Object.fromEntries(request.headers.entries())),
        ...(body !== null && { body: sanitizeRequestData(body) }),
        ...(context !== undefined && { context: sanitizeRequestData(context) }),
        ...(error !== null &&
          typeof error === 'object' &&
          'code' in error && { dbErrorCode: (error as { code: unknown }).code }),
        ...(error !== null &&
          typeof error === 'object' &&
          'meta' in error && { dbErrorMeta: (error as { meta: unknown }).meta }),
      },
      'api error'
    )
  } catch (loggingError) {
    logger.error({ err: loggingError, originalError: error }, 'error logging failed')
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
      keyLower.includes('secret')
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
