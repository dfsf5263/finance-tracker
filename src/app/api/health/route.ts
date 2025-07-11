import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
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
    console.error('Health check failed:', error)

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
}
