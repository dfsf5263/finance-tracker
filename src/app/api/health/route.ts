import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import logger from '@/lib/logger'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const GET = withApiLogging(async () => {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`

    // Return healthy status
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        service: 'finance-tracker',
        version: process.env.npm_package_version || '1.0.0',
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error({ err: error }, 'health check failed')

    // Return unhealthy status
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        service: 'finance-tracker',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}, 'debug')
