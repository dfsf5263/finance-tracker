import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
import { findDuplicates, getDuplicateStats } from '@/lib/duplicate-detector'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 })
    }

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, householdId)
    if (result instanceof NextResponse) {
      return result
    }

    // Build date filter
    const dateFilter: Record<string, Date> = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    // Fetch transactions for the household within the date range
    const transactions = await db.transaction.findMany({
      where: {
        householdId,
        ...(Object.keys(dateFilter).length > 0 && {
          transactionDate: dateFilter,
        }),
      },
      include: {
        account: {
          select: { name: true },
        },
        category: {
          select: { name: true },
        },
        type: {
          select: { name: true },
        },
        user: {
          select: { name: true },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
    })

    // Transform transactions to the format expected by duplicate detector
    const transformedTransactions = transactions.map((t) => ({
      id: t.id,
      transactionDate: t.transactionDate.toISOString().split('T')[0],
      description: t.description,
      amount: Number(t.amount),
      account: t.account.name,
      category: t.category?.name || 'Uncategorized',
      type: t.type?.name || 'Unknown',
      user: t.user?.name || 'Unknown',
      memo: t.memo || undefined,
    }))

    // Find duplicate pairs
    const duplicatePairs = findDuplicates(transformedTransactions, 5) // 5-day window

    // Get summary statistics
    const stats = getDuplicateStats(duplicatePairs)

    return NextResponse.json({
      duplicatePairs,
      stats,
      totalTransactions: transformedTransactions.length,
      dateRange: {
        startDate,
        endDate,
      },
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'find duplicate transactions',
      context: {
        householdId: new URL(request.url).searchParams.get('householdId'),
        startDate: new URL(request.url).searchParams.get('startDate'),
        endDate: new URL(request.url).searchParams.get('endDate'),
      },
    })
    return NextResponse.json({ error: 'Failed to find duplicate transactions' }, { status: 500 })
  }
}
