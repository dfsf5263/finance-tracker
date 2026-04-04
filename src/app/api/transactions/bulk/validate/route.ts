import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody } from '@/lib/validation'
import { bulkUploadRequestSchema, type BulkTransaction } from '@/lib/validation/bulk-upload'
import { withApiLogging } from '@/lib/middleware/with-api-logging'
import logger from '@/lib/logger'
import {
  parseValidationErrors,
  checkIntraFileDuplicates,
  checkDuplicateTransactions,
  validateEntities,
  getEntityValidationFailures,
} from '@/lib/bulk-upload-helpers'

export const POST = withApiLogging(async (request: NextRequest) => {
  let body: unknown

  try {
    body = await request.json()
    const validation = validateRequestBody(bulkUploadRequestSchema, body)

    if (!validation.success) {
      const parsedErrors = parseValidationErrors(validation.error)
      logger.warn({ errorCount: parsedErrors.length }, 'bulk validate: schema validation failed')

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
    logger.info(
      { transactionCount: transactions.length, householdId },
      'bulk validate: starting dry-run'
    )

    const authResult = await requireHouseholdWriteAccess(request, householdId)
    if (authResult instanceof NextResponse) return authResult

    // 1. Intra-file duplicates
    const intraFileDuplicates = checkIntraFileDuplicates(transactions)

    // 2. Database duplicates
    const dbDuplicates = await checkDuplicateTransactions(db, transactions, householdId)

    // Combine duplicate row numbers
    const duplicateRows = new Set([
      ...intraFileDuplicates.map((d) => d.row),
      ...dbDuplicates.map((d) => d.row),
    ])

    // Separate valid from duplicate transactions, tracking original row numbers
    const validTransactionRows: number[] = []
    const validTransactions = transactions.filter((_, index) => {
      const row = index + 2
      if (!duplicateRows.has(row)) {
        validTransactionRows.push(row)
        return true
      }
      return false
    })

    const failures: Array<{
      index: number
      row: number
      transaction: BulkTransaction
      issues: Array<{ kind: 'format' | 'entity' | 'duplicate'; fields: string[]; message: string }>
      existingTransaction?: {
        createdAt: string
        account: string
        amount: string
        description: string
        transactionDate: string
      }
    }> = []

    const failureRows = new Set<number>()

    // Add intra-file duplicates
    intraFileDuplicates.forEach((d) => {
      if (!failureRows.has(d.row)) {
        failures.push({
          index: d.row - 2,
          row: d.row,
          transaction: d.transaction,
          issues: [
            {
              kind: 'duplicate',
              fields: ['transactionDate', 'description', 'amount'],
              message: `Duplicate transaction within file (also appears in rows: ${d.duplicateRows.filter((r) => r !== d.row).join(', ')})`,
            },
          ],
        })
        failureRows.add(d.row)
      }
    })

    // Add database duplicates
    dbDuplicates.forEach((d) => {
      if (!failureRows.has(d.row)) {
        failures.push({
          index: d.row - 2,
          row: d.row,
          transaction: d.transaction,
          issues: [
            {
              kind: 'duplicate',
              fields: ['transactionDate', 'description', 'amount'],
              message: 'Duplicate transaction exists in database',
            },
          ],
          existingTransaction: d.existingTransaction,
        })
        failureRows.add(d.row)
      }
    })

    // 3. Entity validation (without a write transaction — read-only)
    if (validTransactions.length > 0) {
      const entityValidation = await validateEntities(db, validTransactions, householdId)

      if (!entityValidation.valid) {
        const entityFailures = getEntityValidationFailures(
          validTransactions,
          entityValidation,
          validTransactionRows
        )
        entityFailures.forEach((ef) => {
          failures.push({
            index: ef.row - 2,
            row: ef.row,
            transaction: ef.transaction,
            issues: ef.issues,
          })
        })
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

    const failedCount = transformedFailures.length
    const validCount = transactions.length - failedCount

    logger.info(
      { total: transactions.length, valid: validCount, failed: failedCount },
      'bulk validate: dry-run complete'
    )

    return NextResponse.json({
      success: true,
      results: {
        total: transactions.length,
        valid: validCount,
        failed: failedCount,
        failures: transformedFailures,
      },
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'bulk transaction validate',
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
      },
    })

    return NextResponse.json({ error: 'Failed to validate bulk transactions' }, { status: 500 })
  }
})
