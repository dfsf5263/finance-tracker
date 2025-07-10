import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    const accounts = await db.householdAccount.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
      include: { household: true },
    })
    return NextResponse.json(accounts)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch accounts',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let requestData
  try {
    requestData = await request.json()
    const { name, householdId } = requestData

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    const account = await db.householdAccount.create({
      data: { name, householdId },
      include: { household: true },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create account',
      context: {
        householdId: requestData?.householdId,
        accountName: requestData?.name,
      },
    })
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
