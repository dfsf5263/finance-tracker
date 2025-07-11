import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string // Custom key generator
  skipSuccessfulRequests?: boolean // Skip counting successful requests
  skipFailedRequests?: boolean // Skip counting failed requests
  message?: string // Error message to return
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
// In production, you'd want to use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  },
  5 * 60 * 1000
)

/**
 * Create a rate limiter middleware function
 */
export function createRateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: NextRequest) => getClientIP(req),
    message = 'Too many requests, please try again later.',
  } = config

  return async function rateLimit(req: NextRequest): Promise<NextResponse | null> {
    const key = keyGenerator(req)
    const now = Date.now()
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      }
      rateLimitStore.set(key, entry)
    }

    // Check if limit exceeded
    if (entry.count >= maxRequests) {
      return NextResponse.json(
        {
          error: message,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString(),
            'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
          },
        }
      )
    }

    // Increment counter
    entry.count++

    // Return null to allow the request to proceed
    return null
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(req: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const cfConnectingIP = req.headers.get('cf-connecting-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback to a default value
  return 'unknown'
}

/**
 * Create rate limiter for authenticated users based on user ID
 */
export function createUserRateLimit(config: RateLimitConfig) {
  return createRateLimit({
    ...config,
    keyGenerator: (req: NextRequest) => {
      // Try to get user ID from auth context
      // This would need to be implemented based on your auth system
      const userId = req.headers.get('x-user-id') || getClientIP(req)
      return `user:${userId}`
    },
  })
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const apiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minutes
  maxRequests: 120, // 60 requests per minute
  message: 'Too many API requests, please try again later.',
})

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
})

export const strictRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 30 requests per minute
  message: 'Rate limit exceeded, please slow down.',
})

// Enhanced bulk upload rate limiter with stricter limits
export const bulkUploadRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // Only 10 bulk uploads per 1 minute
  message: 'Too many bulk uploads. Please wait before uploading again.',
})
