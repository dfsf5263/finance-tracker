import { NextRequest, NextResponse } from 'next/server'
import { authCompat } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  let currentUser
  let data
  try {
    const { id, userId } = await params

    // Get the authenticated user
    const { userId: currentUserId } = await authCompat()
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the current user in our database
    currentUser = await db.user.findUnique({
      where: { id: currentUserId },
    })

    if (!currentUser) {
      return NextResponse.json(
        {
          error: 'User not found in database. Please try logging out and back in.',
        },
        { status: 404 }
      )
    }

    // Check if current user is owner of this household
    const currentUserHousehold = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: currentUser.id,
          householdId: id,
        },
      },
    })

    if (!currentUserHousehold || currentUserHousehold.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can modify member roles' }, { status: 403 })
    }

    // Get the new role from request body
    data = await request.json()
    const { role } = data

    if (!role || !['OWNER', 'MEMBER', 'VIEWER'].includes(role)) {
      return NextResponse.json({ error: 'Valid role is required' }, { status: 400 })
    }

    // Check if target member exists
    const targetMember = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: id,
        },
      },
    })

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent user from changing their own role
    if (currentUser.id === userId) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    // Update member role
    const updatedMember = await db.userHousehold.update({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: id,
        },
      },
      data: { role: role as 'OWNER' | 'MEMBER' | 'VIEWER' },
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
    })

    return NextResponse.json(updatedMember)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update member role',
      context: {
        householdId: (await params).id,
        targetUserId: (await params).userId,
        currentUserId: currentUser?.id,
        newRole: data?.role,
      },
    })
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  let currentUser
  try {
    const { id, userId } = await params

    // Get the authenticated user
    const { userId: currentUserId } = await authCompat()
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the current user in our database
    currentUser = await db.user.findUnique({
      where: { id: currentUserId },
    })

    if (!currentUser) {
      return NextResponse.json(
        {
          error: 'User not found in database. Please try logging out and back in.',
        },
        { status: 404 }
      )
    }

    // Check if current user is owner of this household or removing themselves
    const currentUserHousehold = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: currentUser.id,
          householdId: id,
        },
      },
    })

    if (!currentUserHousehold) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const isOwner = currentUserHousehold.role === 'OWNER'
    const isRemovingSelf = currentUser.id === userId

    if (!isOwner && !isRemovingSelf) {
      return NextResponse.json({ error: 'Only owners can remove members' }, { status: 403 })
    }

    // Check if target member exists
    const targetMember = await db.userHousehold.findUnique({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: id,
        },
      },
    })

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent removing the last owner
    if (targetMember.role === 'OWNER') {
      const ownerCount = await db.userHousehold.count({
        where: {
          householdId: id,
          role: 'OWNER',
        },
      })

      if (ownerCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 })
      }
    }

    // Remove member
    await db.userHousehold.delete({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'remove member',
      context: {
        householdId: (await params).id,
        targetUserId: (await params).userId,
        currentUserId: currentUser?.id,
      },
    })
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
