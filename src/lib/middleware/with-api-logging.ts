import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse>

type LogLevel = 'debug' | 'info'

export function withApiLogging(handler: RouteHandler, logLevel: LogLevel = 'info'): RouteHandler {
  return async (request, context) => {
    const start = Date.now()
    const correlationId = request.headers.get('x-correlation-id')
    const reqLog = { correlationId, method: request.method, url: request.url }

    logger[logLevel](reqLog, 'api request')

    try {
      const response = await handler(request, context)
      logger[logLevel](
        {
          ...reqLog,
          status: response.status,
          durationMs: Date.now() - start,
        },
        'api response'
      )
      return response
    } catch (err) {
      logger.error({ ...reqLog, err, durationMs: Date.now() - start }, 'unhandled api error')
      throw err
    }
  }
}
