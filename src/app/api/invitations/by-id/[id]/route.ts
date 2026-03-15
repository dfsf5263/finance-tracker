import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const DELETE = withApiLogging(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params

      // Get the authenticated user
      const authContext = await requireAuth()
      if (authContext instanceof NextResponse) return authContext

      const userId = authContext.userId

      // Find the invitation
      const invitation = await db.householdInvitation.findUnique({
        where: { id },
      })

      if (!invitation) {
        return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
      }

      // Check if user is the inviter or has owner access to the household
      const userHousehold = await db.userHousehold.findUnique({
        where: {
          userId_householdId: {
            userId,
            householdId: invitation.householdId,
          },
        },
      })

      if (
        !userHousehold ||
        (userHousehold.role !== 'OWNER' && invitation.inviterUserId !== userId)
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Delete the invitation
      await db.householdInvitation.delete({
        where: { id },
      })

      return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
      await logApiError({
        request,
        error,
        operation: 'delete invitation',
        context: { invitationId: (await params).id },
      })
      return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 })
    }
  }
)
