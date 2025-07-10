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

    const types = await db.householdType.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
      include: { household: true },
    })
    return NextResponse.json(types)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch types',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch types' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let requestData
  try {
    requestData = await request.json()
    const { name, isOutflow, householdId } = requestData

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
    await logApiError({
      request,
      error,
      operation: 'create type',
      context: {
        householdId: requestData?.householdId,
        typeName: requestData?.name,
        isOutflow: requestData?.isOutflow,
      },
    })
    return NextResponse.json({ error: 'Failed to create type' }, { status: 500 })
  }
}
