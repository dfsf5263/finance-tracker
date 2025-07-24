import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { logApiError } from '@/lib/error-logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user
  try {
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
        userId: user?.id,
      },
    })
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}
