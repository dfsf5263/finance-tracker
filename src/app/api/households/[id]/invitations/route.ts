import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Ensure user exists in database
    const { user } = await ensureUser()

    // Check if user has access to this household
    const userHousehold = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: user.id,
          householdId: id,
        },
      },
    })

    if (!userHousehold) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get household invitations
    const invitations = await db.householdInvitation.findMany({
      where: { householdId: id },
      include: {
        inviter: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        invitee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Ensure user exists in database
    const { user } = await ensureUser()

    // Check if user is owner or member of this household
    const userHousehold = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: user.id,
          householdId: id,
        },
      },
    })

    if (!userHousehold || userHousehold.role === 'VIEWER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const data = await request.json()
    const { role, expiresInDays = 7 } = data

    if (!role || !['OWNER', 'MEMBER', 'VIEWER'].includes(role)) {
      return NextResponse.json({ error: 'Valid role is required' }, { status: 400 })
    }

    // Only owners can invite other owners
    if (role === 'OWNER' && userHousehold.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can invite other owners' }, { status: 403 })
    }

    // Create expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Create invitation
    const invitation = await db.householdInvitation.create({
      data: {
        householdId: id,
        inviterUserId: user.id,
        inviteeEmail: '', // Not used for link-based invitations
        role: role as 'OWNER' | 'MEMBER' | 'VIEWER',
        status: 'PENDING',
        expiresAt,
      },
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

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }
}
