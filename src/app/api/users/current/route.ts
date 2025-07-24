import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'

export async function GET() {
  let userId: string | undefined
  try {
    // Require authentication
    const { user, error } = await requireAuth()
    if (error) return error
    userId = user.id

    // Get the user record with basic information
    const userRecord = await db.user.findUnique({
      where: { id: user.id },
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
      request: new Request('http://localhost/api/users/current', { method: 'GET' }) as NextRequest,
      error,
      operation: 'fetch current user',
      context: { userId },
    })
    return NextResponse.json({ error: 'Failed to fetch current user' }, { status: 500 })
  }
}
