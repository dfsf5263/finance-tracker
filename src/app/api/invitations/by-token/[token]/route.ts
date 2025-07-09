import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the invitation
    const invitation = await db.householdInvitation.findUnique({
      where: { token },
      include: {
        household: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                members: true,
              },
            },
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

    // Return invitation details without sensitive information
    return NextResponse.json({
      id: invitation.id,
      household: invitation.household,
      inviter: invitation.inviter,
      role: invitation.role,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error('Error fetching invitation:', error)
    return NextResponse.json({ error: 'Failed to fetch invitation' }, { status: 500 })
  }
}
