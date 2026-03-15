import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const GET = withApiLogging(async (_request: NextRequest) => {
  let userId: string | undefined
  try {
    // Require authentication
    const authContext = await requireAuth()
    if (authContext instanceof NextResponse) return authContext
    userId = authContext.userId

    // Get the user record with basic information
    const userRecord = await db.user.findUnique({
      where: { id: authContext.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        twoFactorEnabled: true,
      },
    })

    if (!userRecord) {
      return NextResponse.json(
        {
          error: 'User account not found. Please sign out and sign back in.',
        },
        { status: 401 }
      )
    }

    return NextResponse.json(userRecord)
  } catch (error) {
    await logApiError({
      request: _request,
      error,
      operation: 'fetch current user',
      context: { userId },
    })
    return NextResponse.json({ error: 'Failed to fetch current user' }, { status: 500 })
  }
})
