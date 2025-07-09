import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'

export async function GET() {
  try {
    // Ensure user exists in database
    const { user } = await ensureUser()

    // Get user with households
    const userWithHouseholds = await db.user.findUnique({
      where: { id: user.id },
      include: {
        households: {
          include: {
            household: {
              include: {
                _count: {
                  select: {
                    accounts: true,
                    users: true,
                    categories: true,
                    types: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!userWithHouseholds) {
      return NextResponse.json(
        {
          error: 'User not found in database. Please try logging out and back in.',
        },
        { status: 404 }
      )
    }

    // Return only households the user has access to
    const households = userWithHouseholds.households.map((uh) => ({
      ...uh.household,
      userRole: uh.role,
    }))

    return NextResponse.json(households)
  } catch (error) {
    console.error('Error fetching households:', error)
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure user exists in database
    const { user } = await ensureUser()

    const data = await request.json()
    const { name, annualBudget } = data

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const householdData: { name: string; annualBudget?: string | number } = { name }

    if (annualBudget !== undefined && annualBudget !== null && annualBudget !== '') {
      householdData.annualBudget = annualBudget
    }

    // Create household and user-household relationship in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the household
      const household = await tx.household.create({
        data: householdData,
      })

      // Create the user-household relationship with OWNER role
      await tx.userHousehold.create({
        data: {
          userId: user.id,
          householdId: household.id,
          role: 'OWNER',
        },
      })

      // Return household with counts
      return tx.household.findUnique({
        where: { id: household.id },
        include: {
          _count: {
            select: {
              accounts: true,
              users: true,
              categories: true,
              types: true,
            },
          },
        },
      })
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating household:', error)
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 })
  }
}
