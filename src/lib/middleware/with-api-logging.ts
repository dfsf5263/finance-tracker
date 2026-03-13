import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse>

export function withApiLogging(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const start = Date.now()
    logger.info({ method: request.method, url: request.url }, 'api request')

    try {
      const response = await handler(request, context)
      logger.info(
        {
          method: request.method,
          url: request.url,
          status: response.status,
          durationMs: Date.now() - start,
        },
        'api response'
      )
      return response
    } catch (err) {
      logger.error(
        { method: request.method, url: request.url, err, durationMs: Date.now() - start },
        'unhandled api error'
      )
      throw err
    }
  }
}
