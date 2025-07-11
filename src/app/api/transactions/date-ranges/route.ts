import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentYear, getCurrentMonth } from '@/lib/utils'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
import { apiRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    // Get the earliest and latest transaction dates for the household
    const dateRange = await db.transaction.aggregate({
      where: {
        householdId: householdId,
      },
      _min: {
        transactionDate: true,
      },
      _max: {
        transactionDate: true,
      },
    })

    const minDate = dateRange._min.transactionDate
    const maxDate = dateRange._max.transactionDate

    if (!minDate || !maxDate) {
      // No transactions found
      return NextResponse.json({
        years: [],
        currentYear: getCurrentYear(),
        currentMonth: getCurrentMonth(),
      })
    }

    // Generate array of years from min to max
    const minYear = minDate.getFullYear()
    const maxYear = maxDate.getFullYear()
    const years: number[] = []

    for (let year = maxYear; year >= minYear; year--) {
      years.push(year)
    }

    return NextResponse.json({
      years,
      currentYear: getCurrentYear(),
      currentMonth: getCurrentMonth(),
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch date ranges',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch date ranges' }, { status: 500 })
  }
}
