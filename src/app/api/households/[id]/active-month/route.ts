import { authCompat } from '@/lib/auth-helpers'
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getMonthName, getCurrentMonth, getCurrentYear } from '@/lib/utils'
import { logApiError } from '@/lib/error-logger'

// Use singleton pattern for Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Await the params as required by Next.js 15
  const { id: householdId } = await params

  try {
    // Step 1: Authentication
    const { userId } = await authCompat()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate household ID format
    if (!householdId || typeof householdId !== 'string') {
      return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 })
    }

    // Step 2: Verify user has access to this household

    const household = await prisma.household.findFirst({
      where: {
        id: householdId,
        members: {
          some: {
            user: {
              id: userId,
            },
          },
        },
      },
    })

    if (!household) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 })
    }

    // Step 3: Get months with transaction activity using parameterized query
    let transactionMonths: Array<{ year: number; month: number; unique_days: bigint }> = []

    try {
      transactionMonths = await prisma.transaction
        .groupBy({
          by: ['transactionDate'],
          where: {
            householdId: householdId,
          },
          _count: {
            transactionDate: true,
          },
        })
        .then((results) => {
          // Group by year and month, counting unique days
          const monthGroups = new Map<string, Set<string>>()

          results.forEach((result) => {
            const date = new Date(result.transactionDate)
            const year = date.getFullYear()
            const month = date.getMonth() + 1
            const day = date.getDate()
            const key = `${year}-${month}`

            if (!monthGroups.has(key)) {
              monthGroups.set(key, new Set())
            }
            monthGroups.get(key)!.add(day.toString())
          })

          // Convert to required format and filter for months with ≥5 unique days
          return Array.from(monthGroups.entries())
            .filter(([, days]) => days.size >= 5)
            .map(([key, days]) => {
              const [year, month] = key.split('-').map(Number)
              return {
                year,
                month,
                unique_days: BigInt(days.size),
              }
            })
            .sort((a, b) => {
              if (a.year !== b.year) return b.year - a.year
              return b.month - a.month
            })
            .slice(0, 1)
        })
    } catch (queryError) {
      await logApiError({
        request,
        error: queryError,
        operation: 'query transaction months',
        context: {
          householdId,
          userId,
        },
      })
      // Fall back to using current month if query fails
      transactionMonths = []
    }

    // Step 4: Determine the active month
    const currentMonth = getCurrentMonth()
    const currentYear = getCurrentYear()

    // If no month has 5+ days of transactions, use current month
    if (transactionMonths.length === 0) {
      const result = {
        year: currentYear,
        month: currentMonth,
        monthName: getMonthName(currentMonth),
        isCurrentMonth: true,
        message: 'Using current month (no month with 5+ transaction days found)',
      }
      return NextResponse.json(result)
    }

    const activeMonth = transactionMonths[0]
    const isCurrentMonth = activeMonth.year === currentYear && activeMonth.month === currentMonth

    const result = {
      year: activeMonth.year,
      month: activeMonth.month,
      monthName: getMonthName(activeMonth.month),
      isCurrentMonth,
      uniqueDays: Number(activeMonth.unique_days),
      message: isCurrentMonth
        ? 'Using current month'
        : `Using ${getMonthName(activeMonth.month)} ${activeMonth.year} (most recent month with 5+ transaction days)`,
    }

    return NextResponse.json(result)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch active month',
      context: {
        householdId,
      },
    })

    // Return current month as fallback with detailed error
    const currentMonth = getCurrentMonth()
    const currentYear = getCurrentYear()

    return NextResponse.json(
      {
        year: currentYear,
        month: currentMonth,
        monthName: getMonthName(currentMonth),
        isCurrentMonth: true,
        message: 'Using current month (error occurred while determining active month)',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    ) // Return 200 with fallback data instead of 500 error
  }
  // Note: Don't disconnect Prisma in serverless environment
}
