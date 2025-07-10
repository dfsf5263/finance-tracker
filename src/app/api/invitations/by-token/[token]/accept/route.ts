import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { logApiError } from '@/lib/error-logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  let user: { id: string } | undefined
  try {
    const { token } = await params

    // Ensure user exists in database
    const userResult = await ensureUser()
    user = userResult.user

    // Find the invitation
    const invitation = await db.householdInvitation.findUnique({
      where: { token },
      include: {
        household: {
          select: {
            name: true,
          },
        },
        inviter: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    // Check if invitation is still pending
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ error: 'Invitation is no longer valid' }, { status: 400 })
    }

    // Check if user is already a member of this household
    const existingMembership = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: user.id,
          householdId: invitation.householdId,
        },
      },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You are already a member of this household' },
        { status: 400 }
      )
    }

    // Use the role from the invitation record
    const role = invitation.role

    // Create the user-household relationship and update invitation in a transaction
    const transactionResult = await db.$transaction(async (tx) => {
      // Create user-household relationship
      const userHousehold = await tx.userHousehold.create({
        data: {
          userId: user!.id,
          householdId: invitation.householdId,
          role: role,
          invitedBy: invitation.inviterUserId,
        },
      })

      // Update invitation status
      await tx.householdInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          inviteeUserId: user!.id,
        },
      })

      return userHousehold
    })

    return NextResponse.json(
      {
        success: true,
        household: invitation.household,
        role: transactionResult.role,
      },
      { status: 200 }
    )
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'accept invitation',
      context: {
        tokenProvided: !!(await params).token,
        userId: user?.id,
      },
    })
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
}
