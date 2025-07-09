import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const households = await db.household.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            accounts: true,
            users: true,
            categories: true,
            types: true,
            transactions: true,
          },
        },
      },
    })
    return NextResponse.json(households)
  } catch (error) {
    console.error('Error fetching households:', error)
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { name, annualBudget } = data

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const householdData: { name: string; annualBudget?: string | number } = { name }

    if (annualBudget !== undefined && annualBudget !== null && annualBudget !== '') {
      householdData.annualBudget = annualBudget
    }

    const household = await db.household.create({
      data: householdData,
      include: {
        _count: {
          select: {
            accounts: true,
            users: true,
            categories: true,
            types: true,
            transactions: true,
          },
        },
      },
    })

    return NextResponse.json(household, { status: 201 })
  } catch (error) {
    console.error('Error creating household:', error)
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 })
  }
}