import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { logApiError } from '@/lib/error-logger'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const GET = withApiLogging(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    let userId: string | undefined
    try {
      const { id } = await params

      // Ensure user exists in database
      const authContext = await requireAuth()
      if (authContext instanceof NextResponse) return authContext
      userId = authContext.userId

      // Check if user has access to this household
      const userHousehold = await db.userHousehold.findUnique({
        where: {
          userId_householdId: {
            userId,
            householdId: id,
          },
        },
      })

      if (!userHousehold) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Get household members
      const members = await db.userHousehold.findMany({
        where: { householdId: id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // OWNER first, then MEMBER, then VIEWER
          { joinedAt: 'asc' },
        ],
      })

      return NextResponse.json(members)
    } catch (error) {
      await logApiError({
        request,
        error,
        operation: 'fetch household members',
        context: {
          householdId: (await params).id,
          userId,
        },
      })
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }
  }
)
