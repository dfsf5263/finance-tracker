import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess, requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody, typeCreateSchema } from '@/lib/validation'
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
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    // Parse and validate request body
    requestData = await request.json()
    const validation = validateRequestBody(typeCreateSchema, requestData)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, isOutflow, householdId } = validation.data

    // Verify user has write access to this household
    const result = await requireHouseholdWriteAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
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
