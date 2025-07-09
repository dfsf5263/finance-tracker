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
    console.error('Error fetching members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}
