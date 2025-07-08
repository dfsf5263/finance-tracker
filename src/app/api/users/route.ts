import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const users = await db.transactionUser.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { name, annualBudget } = data

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const userData: { name: string; annualBudget?: string | number } = { name }

    if (annualBudget !== undefined && annualBudget !== null && annualBudget !== '') {
      userData.annualBudget = annualBudget
    }

    const user = await db.transactionUser.create({
      data: userData,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
