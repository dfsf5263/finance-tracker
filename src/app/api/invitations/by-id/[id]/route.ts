import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get the authenticated user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the user in our database
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    })

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found in database. Please try logging out and back in.',
        },
        { status: 404 }
      )
    }

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
          userId: user.id,
          householdId: invitation.householdId,
        },
      },
    })

    if (
      !userHousehold ||
      (userHousehold.role !== 'OWNER' && invitation.inviterUserId !== user.id)
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
