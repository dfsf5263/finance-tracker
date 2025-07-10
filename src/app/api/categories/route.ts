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

    const categories = await db.householdCategory.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
      include: { household: true },
    })
    return NextResponse.json(categories)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch categories',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
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

    const categoryData: { name: string; householdId: string; annualBudget?: string | number } = {
      name,
      householdId,
    }

    if (annualBudget !== undefined && annualBudget !== null && annualBudget !== '') {
      categoryData.annualBudget = annualBudget
    }

    const category = await db.householdCategory.create({
      data: categoryData,
      include: { household: true },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create category',
      context: {
        householdId: data?.householdId,
        categoryName: data?.name,
      },
    })
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
