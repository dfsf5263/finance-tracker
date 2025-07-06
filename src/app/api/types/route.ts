import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const types = await db.transactionType.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(types)
  } catch (error) {
    console.error('Error fetching transaction types:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction types' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, isOutflow } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const type = await db.transactionType.create({
      data: {
        name,
        isOutflow: isOutflow !== undefined ? isOutflow : true,
      },
    })

    return NextResponse.json(type, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction type:', error)
    return NextResponse.json({ error: 'Failed to create transaction type' }, { status: 500 })
  }
}
