import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess, requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody, accountCreateSchema } from '@/lib/validation'
import { apiRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

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
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    // Parse and validate request body
    requestData = await request.json()
    const validation = validateRequestBody(accountCreateSchema, requestData)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, householdId } = validation.data

    // Verify user has write access to this household
    const result = await requireHouseholdWriteAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    const account = await db.householdAccount.create({
      data: {
        name,
        householdId,
      },
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
