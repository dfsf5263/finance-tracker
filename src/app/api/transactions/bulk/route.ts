import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { logApiError } from '@/lib/error-logger'
import { bulkUploadRateLimit } from '@/lib/rate-limit'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody } from '@/lib/validation'
import { bulkUploadRequestSchema, type BulkTransaction } from '@/lib/validation/bulk-upload'
// parseMMDDYYYY is no longer needed - dates are now in ISO format from validation

interface ValidationError {
  row: number
  field: string
  value: string
  message: string
}

export async function POST(request: NextRequest) {
  let body: unknown

  try {
    // Apply general bulk upload rate limiting
    const rateLimitResult = await bulkUploadRateLimit(request)
    if (rateLimitResult) return rateLimitResult

    // Parse and validate body
    body = await request.json()
    const validation = validateRequestBody(bulkUploadRequestSchema, body)

    if (!validation.success) {
      const parsedErrors = parseValidationErrors(validation.error)

      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error,
          validationErrors: parsedErrors,
        },
        { status: 400 }
      )
    }

    const { transactions, householdId } = validation.data

    // Verify user has write access to household
    const authResult = await requireHouseholdWriteAccess(request, householdId)
    if (authResult instanceof NextResponse) return authResult

    // Check for intra-file duplicates first
    const intraFileDuplicates = checkIntraFileDuplicates(transactions)

    // Check for duplicates against database
    const dbDuplicates = await checkDuplicateTransactions(transactions, householdId)

    // Combine all duplicate row numbers
    const duplicateRows = new Set([
      ...intraFileDuplicates.map((d) => d.row),
      ...dbDuplicates.map((d) => d.row),
    ])

    // Separate valid from duplicate transactions
    const validTransactions = transactions.filter(
      (_, index) => !duplicateRows.has(index + 2) // +2 for header row and 0-index
    )

    const failures: Array<{
      row: number
      type: 'duplicate' | 'validation'
      transaction: BulkTransaction
      reason: string
      existingTransaction?: {
        createdAt: string
        account: string
        amount: string
        description: string
        transactionDate: string
      }
    }> = []

    // Create a map to track which rows have already been added as failures
    const failureRows = new Set<number>()

    // Add intra-file duplicates to failures first
    intraFileDuplicates.forEach((d) => {
      if (!failureRows.has(d.row)) {
        failures.push({
          row: d.row,
          type: 'duplicate' as const,
          transaction: d.transaction,
          reason: `Duplicate transaction within file (also appears in rows: ${d.duplicateRows.filter((r) => r !== d.row).join(', ')})`,
        })
        failureRows.add(d.row)
      }
    })

    // Add database duplicates to failures, but only if not already added as intra-file duplicate
    dbDuplicates.forEach((d) => {
      if (!failureRows.has(d.row)) {
        failures.push({
          row: d.row,
          type: 'duplicate' as const,
          transaction: d.transaction,
          reason: 'Duplicate transaction exists in database',
          existingTransaction: d.existingTransaction,
        })
        failureRows.add(d.row)
      }
    })

    let successfulCount = 0

    // Process valid transactions if any exist
    if (validTransactions.length > 0) {
      try {
        const result = await db.$transaction(async (tx) => {
          // Validate all entities exist
          const entityValidation = await validateEntities(tx, validTransactions, householdId)

          if (!entityValidation.valid) {
            // Add entity validation failures
            const entityFailures = getEntityValidationFailures(validTransactions, entityValidation)
            failures.push(...entityFailures)

            // Filter out transactions with entity failures
            const finalValidTransactions = filterOutEntityFailures(
              validTransactions,
              entityValidation
            )

            if (finalValidTransactions.length === 0) {
              return { count: 0 }
            }

            // Prepare final valid transactions
            const preparedTransactions = finalValidTransactions.map((t: BulkTransaction) => ({
              householdId,
              accountId: entityValidation.accountMap.get(t.account)!,
              userId: t.user ? entityValidation.userMap.get(t.user) : null,
              transactionDate: t.transactionDate, // t.transactionDate is now in ISO DateTime format
              postDate: t.postDate || t.transactionDate,
              description: t.description,
              categoryId: entityValidation.categoryMap.get(t.category)!,
              typeId: entityValidation.typeMap.get(t.type)!,
              amount: new Decimal(parseFloat(t.amount)),
              memo: t.memo || '',
            }))

            return await tx.transaction.createMany({
              data: preparedTransactions,
            })
          }

          // All transactions are valid, prepare them
          const preparedTransactions = validTransactions.map((t: BulkTransaction) => ({
            householdId,
            accountId: entityValidation.accountMap.get(t.account)!,
            userId: t.user ? entityValidation.userMap.get(t.user) : null,
            transactionDate: t.transactionDate, // t.transactionDate is now in ISO DateTime format
            postDate: t.postDate || t.transactionDate,
            description: t.description,
            categoryId: entityValidation.categoryMap.get(t.category)!,
            typeId: entityValidation.typeMap.get(t.type)!,
            amount: new Decimal(parseFloat(t.amount)),
            memo: t.memo || '',
          }))

          return await tx.transaction.createMany({
            data: preparedTransactions,
          })
        })

        successfulCount = result.count
      } catch (error: unknown) {
        // Check if it's a unique constraint violation (P2002)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // This means some transactions were duplicates that we missed
          // The error doesn't tell us which ones, so we need to handle this differently
          console.warn('Unique constraint violation during bulk insert:', error.message)

          // Since we can't identify which specific transactions failed in a bulk operation,
          // we'll mark all as potentially having constraint violations
          // This shouldn't happen if our duplicate detection is working properly
          validTransactions.forEach((t) => {
            const originalIndex = transactions.findIndex((orig) => orig === t)
            failures.push({
              row: originalIndex + 2,
              type: 'duplicate',
              transaction: t,
              reason: 'Unique constraint violation - transaction may be duplicate',
            })
          })
          successfulCount = 0
        } else {
          // Other database errors
          console.error('Transaction processing failed:', error)
          validTransactions.forEach((t) => {
            const originalIndex = transactions.findIndex((orig) => orig === t)
            failures.push({
              row: originalIndex + 2,
              type: 'validation',
              transaction: t,
              reason: error instanceof Error ? error.message : 'Processing failed',
            })
          })
          successfulCount = 0
        }
      }
    }

    // Transform dates in failure objects to date-only format for frontend
    const transformedFailures = failures.map((failure) => ({
      ...failure,
      transaction: {
        ...failure.transaction,
        transactionDate: failure.transaction.transactionDate.includes('T')
          ? failure.transaction.transactionDate.split('T')[0]
          : failure.transaction.transactionDate,
        postDate: failure.transaction.postDate?.includes('T')
          ? failure.transaction.postDate.split('T')[0]
          : failure.transaction.postDate,
      },
    }))

    return NextResponse.json({
      success: true,
      message:
        failures.length > 0
          ? `Upload completed with ${failures.length} failures`
          : 'Upload completed successfully',
      results: {
        total: transactions.length,
        successful: successfulCount,
        failed: failures.length,
        failures: transformedFailures,
      },
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'bulk transaction upload',
      context: {
        householdId:
          body && typeof body === 'object' && 'householdId' in body ? body.householdId : undefined,
        transactionCount:
          body &&
          typeof body === 'object' &&
          'transactions' in body &&
          Array.isArray(body.transactions)
            ? body.transactions.length
            : 0,
        validationPassed: false,
      },
    })

    // Check if it's an entity validation error
    if (error instanceof Error && error.message.includes('Missing entities')) {
      return NextResponse.json(
        {
          error: 'Entity validation failed',
          message: error.message,
          validationErrors: [
            {
              row: 0,
              field: 'entities',
              value: '',
              message: error.message,
            },
          ],
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create bulk transactions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Helper function to parse Zod validation errors into our format
function parseValidationErrors(errorString: string): ValidationError[] {
  const errors: ValidationError[] = []
  const parts = errorString.split(', ')

  parts.forEach((part) => {
    // Try multiple regex patterns to match different Zod error formats
    let match = part.match(/transactions\.(\d+)\.(\w+): (.+)/) // transactions.0.field: message
    if (!match) {
      match = part.match(/(\d+)\.(\w+): (.+)/) // 0.field: message
    }
    if (!match) {
      match = part.match(/transactions\[(\d+)\]\.(\w+): (.+)/) // transactions[0].field: message
    }

    if (match) {
      const [, rowIndex, field, message] = match
      errors.push({
        row: parseInt(rowIndex) + 2, // +2 for header row and 0-index
        field,
        value: '',
        message,
      })
    } else {
      // Fallback: try to extract any numbers and create a generic error
      const numberMatch = part.match(/(\d+)/)
      if (numberMatch) {
        errors.push({
          row: parseInt(numberMatch[1]) + 2,
          field: 'unknown',
          value: '',
          message: part,
        })
      } else {
        // Last resort: create a general error for row 1
        errors.push({
          row: 2,
          field: 'general',
          value: '',
          message: part,
        })
      }
    }
  })

  return errors
}

// Helper function to check for intra-file duplicates
function checkIntraFileDuplicates(transactions: BulkTransaction[]): Array<{
  row: number
  transaction: BulkTransaction
  duplicateRows: number[]
}> {
  const duplicates = []
  const seen = new Map<string, number[]>()

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]
    // Create unique key based on the same criteria as database unique constraint
    const key = `${t.transactionDate}|${t.description}|${t.amount}`

    if (seen.has(key)) {
      // Found duplicate
      const existingRows = seen.get(key)!
      duplicates.push({
        row: i + 2, // +2 for header row and 0-index
        transaction: t,
        duplicateRows: [...existingRows, i + 2],
      })
      existingRows.push(i + 2)
    } else {
      seen.set(key, [i + 2])
    }
  }

  return duplicates
}

// Helper function to check for duplicate transactions against database
async function checkDuplicateTransactions(
  transactions: BulkTransaction[],
  householdId: string
): Promise<
  Array<{
    row: number
    transaction: BulkTransaction
    existingTransaction: {
      createdAt: string
      account: string
      amount: string
      description: string
      transactionDate: string
    }
  }>
> {
  const duplicates = []

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]
    const date = new Date(t.transactionDate) // t.transactionDate is now in ISO DateTime format

    const existing = await db.transaction.findFirst({
      where: {
        householdId,
        transactionDate: date,
        amount: new Decimal(parseFloat(t.amount)),
        description: t.description,
      },
      select: {
        createdAt: true,
        amount: true,
        description: true,
        transactionDate: true,
        account: {
          select: {
            name: true,
          },
        },
      },
    })

    if (existing) {
      duplicates.push({
        row: i + 2, // +2 for header row and 0-index
        transaction: t,
        existingTransaction: {
          createdAt: existing.createdAt.toISOString(),
          account: existing.account.name,
          amount: existing.amount.toString(),
          description: existing.description,
          transactionDate: existing.transactionDate.toISOString().split('T')[0],
        },
      })
    }
  }

  return duplicates
}

// Helper function to validate entities exist
async function validateEntities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  transactions: BulkTransaction[],
  householdId: string
): Promise<{
  valid: boolean
  error?: string
  accountMap: Map<string, string>
  userMap: Map<string, string>
  categoryMap: Map<string, string>
  typeMap: Map<string, string>
}> {
  const accountNames = [...new Set(transactions.map((t) => t.account))]
  const userNames = [...new Set(transactions.map((t) => t.user).filter(Boolean) as string[])]
  const categoryNames = [...new Set(transactions.map((t) => t.category))]
  const typeNames = [...new Set(transactions.map((t) => t.type))]

  const [accounts, users, categories, types] = await Promise.all([
    tx.householdAccount.findMany({
      where: { name: { in: accountNames }, householdId },
      select: { id: true, name: true },
    }),
    tx.householdUser.findMany({
      where: { name: { in: userNames }, householdId },
      select: { id: true, name: true },
    }),
    tx.householdCategory.findMany({
      where: { name: { in: categoryNames }, householdId },
      select: { id: true, name: true },
    }),
    tx.householdType.findMany({
      where: { name: { in: typeNames }, householdId },
      select: { id: true, name: true },
    }),
  ])

  const accountMap = new Map(accounts.map((a: { name: string; id: string }) => [a.name, a.id]))
  const userMap = new Map(users.map((u: { name: string; id: string }) => [u.name, u.id]))
  const categoryMap = new Map(categories.map((c: { name: string; id: string }) => [c.name, c.id]))
  const typeMap = new Map(types.map((t: { name: string; id: string }) => [t.name, t.id]))

  // Check for missing entities
  const missingAccounts = accountNames.filter((n) => !accountMap.has(n))
  const missingUsers = userNames.filter((n) => n && !userMap.has(n))
  const missingCategories = categoryNames.filter((n) => !categoryMap.has(n))
  const missingTypes = typeNames.filter((n) => !typeMap.has(n))

  if (
    missingAccounts.length ||
    missingUsers.length ||
    missingCategories.length ||
    missingTypes.length
  ) {
    const errors = []
    if (missingAccounts.length) errors.push(`Accounts: ${missingAccounts.join(', ')}`)
    if (missingUsers.length) errors.push(`Users: ${missingUsers.join(', ')}`)
    if (missingCategories.length) errors.push(`Categories: ${missingCategories.join(', ')}`)
    if (missingTypes.length) errors.push(`Types: ${missingTypes.join(', ')}`)

    return {
      valid: false,
      error: `Missing entities - ${errors.join('; ')}. Please define these entities on the definitions page before uploading.`,
      accountMap: accountMap as Map<string, string>,
      userMap: userMap as Map<string, string>,
      categoryMap: categoryMap as Map<string, string>,
      typeMap: typeMap as Map<string, string>,
    }
  }

  return {
    valid: true,
    accountMap: accountMap as Map<string, string>,
    userMap: userMap as Map<string, string>,
    categoryMap: categoryMap as Map<string, string>,
    typeMap: typeMap as Map<string, string>,
  }
}

// Helper function to get entity validation failures
function getEntityValidationFailures(
  transactions: BulkTransaction[],
  entityValidation: {
    valid: boolean
    error?: string
    accountMap: Map<string, string>
    userMap: Map<string, string>
    categoryMap: Map<string, string>
    typeMap: Map<string, string>
  }
): Array<{
  row: number
  type: 'validation'
  transaction: BulkTransaction
  reason: string
}> {
  const failures: Array<{
    row: number
    type: 'validation'
    transaction: BulkTransaction
    reason: string
  }> = []

  transactions.forEach((transaction, index) => {
    const issues: string[] = []

    // Check for missing entities
    if (!entityValidation.accountMap.has(transaction.account)) {
      issues.push(`Account "${transaction.account}" not found`)
    }

    if (transaction.user && !entityValidation.userMap.has(transaction.user)) {
      issues.push(`User "${transaction.user}" not found`)
    }

    if (!entityValidation.categoryMap.has(transaction.category)) {
      issues.push(`Category "${transaction.category}" not found`)
    }

    if (!entityValidation.typeMap.has(transaction.type)) {
      issues.push(`Type "${transaction.type}" not found`)
    }

    if (issues.length > 0) {
      failures.push({
        row: index + 2, // +2 for header row and 0-index
        type: 'validation',
        transaction,
        reason: issues.join(', '),
      })
    }
  })

  return failures
}

// Helper function to filter out transactions with entity failures
function filterOutEntityFailures(
  transactions: BulkTransaction[],
  entityValidation: {
    valid: boolean
    error?: string
    accountMap: Map<string, string>
    userMap: Map<string, string>
    categoryMap: Map<string, string>
    typeMap: Map<string, string>
  }
): BulkTransaction[] {
  return transactions.filter((transaction) => {
    const hasValidAccount = entityValidation.accountMap.has(transaction.account)
    const hasValidUser = !transaction.user || entityValidation.userMap.has(transaction.user)
    const hasValidCategory = entityValidation.categoryMap.has(transaction.category)
    const hasValidType = entityValidation.typeMap.has(transaction.type)

    return hasValidAccount && hasValidUser && hasValidCategory && hasValidType
  })
}
