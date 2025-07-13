import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { logApiError } from '@/lib/error-logger'
import { apiRateLimit } from '@/lib/rate-limit'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
import { canInviteMembers } from '@/lib/role-utils'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params

    // Ensure user exists in database
    const result = await ensureUser()
    user = result.user

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
    await logApiError({
      request,
      error,
      operation: 'fetch household invitations',
      context: {
        householdId: (await params).id,
        userId: user?.id,
      },
    })
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user
  let data
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { id } = await params

    // Verify user has access to this household
    const accessResult = await requireHouseholdAccess(request, id)
    if (accessResult instanceof NextResponse) {
      return accessResult
    }

    user = accessResult.authContext.user

    // Check if user has permission to invite members
    if (!canInviteMembers(accessResult.userRole)) {
      return NextResponse.json(
        { error: 'Only the household owner can invite new members' },
        { status: 403 }
      )
    }

    data = await request.json()
    const { role, expiresInDays = 7 } = data

    if (!role || !['OWNER', 'MEMBER', 'VIEWER'].includes(role)) {
      return NextResponse.json({ error: 'Valid role is required' }, { status: 400 })
    }

    // Only owners can invite other owners
    if (role === 'OWNER' && accessResult.userRole !== 'OWNER') {
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
    await logApiError({
      request,
      error,
      operation: 'create household invitation',
      context: {
        householdId: (await params).id,
        inviterUserId: user?.id,
        role: data?.role,
        expiresInDays: data?.expiresInDays,
      },
    })
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }
}
