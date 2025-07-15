import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { logApiError } from '@/lib/error-logger'

export async function GET() {
  let user: { id: string } | undefined
  try {
    // Ensure user exists in database
    const userResult = await ensureUser()
    user = userResult.user

    // Get the user record with basic information
    const userRecord = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    })

    if (!userRecord) {
      return NextResponse.json(
        {
          error: 'User not found in database. Please try logging out and back in.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(userRecord)
  } catch (error) {
    await logApiError({
      request: new Request('http://localhost/api/users/current', { method: 'GET' }) as NextRequest,
      error,
      operation: 'fetch current user',
      context: { userId: user?.id },
    })
    return NextResponse.json({ error: 'Failed to fetch current user' }, { status: 500 })
  }
}
