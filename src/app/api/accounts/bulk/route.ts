import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const POST = withApiLogging(async (request: NextRequest) => {
  let requestData
  try {
    requestData = await request.json()
    const { accounts, householdId } = requestData

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json({ error: 'Accounts array is required' }, { status: 400 })
    }

    // Verify user has write access to this household
    const authResult = await requireHouseholdWriteAccess(request, householdId)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Get existing accounts for this household to avoid duplicates
    const existingAccounts = await db.householdAccount.findMany({
      where: { householdId },
      select: { name: true },
    })

    const existingNames = new Set(
      existingAccounts.map((acct: { name: string }) => acct.name.toLowerCase())
    )

    // Filter out accounts that already exist (case-insensitive)
    const accountsToCreate = accounts.filter(
      (account: { name: string }) => !existingNames.has(account.name.toLowerCase())
    )

    if (accountsToCreate.length === 0) {
      return NextResponse.json({
        message: 'All accounts already exist',
        created: [],
        skipped: accounts.length,
      })
    }

    // Prepare accounts for bulk creation
    const accountsWithHousehold = accountsToCreate.map((account: { name: string }) => ({
      name: account.name,
      householdId,
    }))

    // Bulk create accounts
    const createResult = await db.householdAccount.createMany({
      data: accountsWithHousehold,
      skipDuplicates: true,
    })

    // Fetch the created accounts to return them
    const createdAccounts = await db.householdAccount.findMany({
      where: {
        householdId,
        name: {
          in: accountsToCreate.map((acct: { name: string }) => acct.name),
        },
      },
    })

    return NextResponse.json({
      message: `Successfully created ${createResult.count} accounts`,
      created: createdAccounts,
      skipped: accounts.length - accountsToCreate.length,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'create bulk accounts',
      context: {
        householdId: requestData?.householdId,
        accountCount: Array.isArray(requestData?.accounts) ? requestData.accounts.length : 0,
      },
    })
    return NextResponse.json({ error: 'Failed to create accounts' }, { status: 500 })
  }
})
