import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendWeeklySummaryEmail } from '@/lib/email'
import { generateHouseholdSummary } from '@/lib/weekly-summary'
import { logApiError } from '@/lib/error-logger'
import logger from '@/lib/logger'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const POST = withApiLogging(async (request: NextRequest) => {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all users with households that have weekly summaries enabled
    const usersWithHouseholds = await db.user.findMany({
      where: {
        households: {
          some: {
            weeklySummary: true,
          },
        },
      },
      include: {
        households: {
          where: {
            weeklySummary: true,
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

    logger.info({ count: usersWithHouseholds.length }, 'found users with weekly summaries enabled')

    const emailResults = []

    // Process each user
    for (const user of usersWithHouseholds) {
      try {
        const summaries = []

        // Generate summary for each household
        for (const userHousehold of user.households) {
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
            logger.error(
              { err: error, householdId: userHousehold.household.id },
              'error generating summary for household'
            )
            // Continue processing other households
          }
        }

        if (summaries.length > 0) {
          logger.info(
            { email: user.email, householdCount: summaries.length },
            'sending weekly summary'
          )
          // Send email with all household summaries
          const emailResult = await sendWeeklySummaryEmail({
            to: user.email,
            userName: user.firstName || 'there',
            summaries,
          })

          emailResults.push({
            userId: user.id,
            email: user.email,
            householdCount: summaries.length,
            success: emailResult.success,
            error: emailResult.error,
          })
        } else {
          logger.info(
            { email: user.email },
            'skipping email - no households with transactions for the reporting period'
          )
        }
      } catch (error) {
        logger.error({ err: error, userId: user.id }, 'error processing user for weekly summary')
        emailResults.push({
          userId: user.id,
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = emailResults.filter((r) => r.success).length
    const failureCount = emailResults.filter((r) => !r.success).length

    logger.info({ successful: successCount, failed: failureCount }, 'weekly summary emails sent')

    return NextResponse.json({
      message: 'Weekly summaries processed',
      results: {
        total: emailResults.length,
        successful: successCount,
        failed: failureCount,
      },
      details: emailResults,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'send weekly summaries',
    })
    return NextResponse.json({ error: 'Failed to process weekly summaries' }, { status: 500 })
  }
})
