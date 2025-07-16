import { NextRequest, NextResponse } from 'next/server'
// Test endpoint for weekly summary emails
import { db } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { sendWeeklySummaryEmail } from '@/lib/email'
import { generateHouseholdSummary } from '@/lib/weekly-summary'
import { logApiError } from '@/lib/error-logger'

export async function POST(request: NextRequest) {
  let user: { id: string; firstName: string | null; email: string } | undefined

  try {
    // Ensure user exists in database
    const userResult = await ensureUser()
    user = userResult.user

    const { searchParams } = new URL(request.url)
    const testHouseholdId = searchParams.get('householdId')
    const asOfDate = searchParams.get('asOfDate')

    // Set test date if provided
    if (asOfDate) {
      // This would require modifying the generateHouseholdSummary function to accept a date parameter
      // For now, we'll just log it
      console.log(`Test running as of date: ${asOfDate}`)
    }

    // Get user's households with weekly summaries enabled
    const userWithHouseholds = await db.user.findUnique({
      where: { id: user.id },
      include: {
        households: {
          where: {
            weeklySummary: true,
            ...(testHouseholdId ? { householdId: testHouseholdId } : {}),
          },
          include: {
            household: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!userWithHouseholds || userWithHouseholds.households.length === 0) {
      return NextResponse.json(
        {
          error: testHouseholdId
            ? 'Household not found or weekly summaries not enabled'
            : 'No households with weekly summaries enabled found',
        },
        { status: 404 }
      )
    }

    const summaries = []

    // Generate summary for each household
    for (const userHousehold of userWithHouseholds.households) {
      try {
        const summary = await generateHouseholdSummary(
          userHousehold.household.id,
          userHousehold.household.name
        )
        // Only add non-null summaries (households with transactions)
        if (summary !== null) {
          summaries.push(summary)
        }
      } catch (error) {
        console.error(
          `Error generating test summary for household ${userHousehold.household.id}:`,
          error
        )
        return NextResponse.json(
          {
            error: `Failed to generate summary for household ${userHousehold.household.name}`,
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
      }
    }

    if (summaries.length === 0) {
      return NextResponse.json({ error: 'No valid summaries could be generated' }, { status: 400 })
    }

    // Send test email
    const emailResult = await sendWeeklySummaryEmail({
      to: user.email,
      userName: user.firstName || 'there',
      summaries,
    })

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to send test email',
          details: emailResult.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Test email sent successfully',
      recipient: user.email,
      householdCount: summaries.length,
      households: summaries.map((s) => ({
        id: s.householdId,
        name: s.householdName,
        reportType: s.period.type,
        periodName: `${s.period.monthName} ${s.period.year}`,
        alertCount: s.budgetAlerts.length,
      })),
      emailData: emailResult.data,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'send test weekly summary',
      context: { userId: user?.id },
    })
    return NextResponse.json({ error: 'Failed to send test weekly summary' }, { status: 500 })
  }
}
