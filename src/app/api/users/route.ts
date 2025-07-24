import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess, requireHouseholdWriteAccess } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const users = await db.householdUser.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
      include: { household: true },
    })
    return NextResponse.json(users)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch users',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let data
  try {
    data = await request.json()
    const { name, annualBudget, householdId } = data

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    // Verify user has write access to this household
    const result = await requireHouseholdWriteAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const userData: { name: string; householdId: string; annualBudget?: string | number } = {
      name,
      householdId,
    }

    if (annualBudget !== undefined && annualBudget !== null && annualBudget !== '') {
      userData.annualBudget = annualBudget
    }

    const user = await db.householdUser.create({
      data: userData,
      include: { household: true },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create user',
      context: {
        householdId: data?.householdId,
        userName: data?.name,
      },
    })
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
