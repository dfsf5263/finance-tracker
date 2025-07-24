import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/error-logger'
import { getTransactionAnalytics } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'category'
    const typeId = searchParams.get('typeId')
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 })
    }

    const analytics = await getTransactionAnalytics({
      householdId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      groupBy: groupBy as 'category' | 'user' | 'account',
      typeId: typeId || undefined,
    })

    return NextResponse.json(analytics)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch analytics',
      context: {
        searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    })
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
