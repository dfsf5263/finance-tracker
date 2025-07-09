import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    const types = await db.householdType.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
      include: { household: true },
    })
    return NextResponse.json(types)
  } catch (error) {
    console.error('Error fetching types:', error)
    return NextResponse.json({ error: 'Failed to fetch types' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, isOutflow, householdId } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    const type = await db.householdType.create({
      data: {
        name,
        householdId,
        isOutflow: isOutflow ?? true,
      },
      include: { household: true },
    })

    return NextResponse.json(type, { status: 201 })
  } catch (error) {
    console.error('Error creating type:', error)
    return NextResponse.json({ error: 'Failed to create type' }, { status: 500 })
  }
}