import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/client'
import { Prisma } from '@prisma/client'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody } from '@/lib/validation'
import { bulkUploadRequestSchema, type BulkTransaction } from '@/lib/validation/bulk-upload'
import { withApiLogging } from '@/lib/middleware/with-api-logging'
import logger from '@/lib/logger'
import {
  isoToUtcNoon,
  parseValidationErrors,
  checkIntraFileDuplicates,
  checkDuplicateTransactions,
  validateEntities,
  getEntityValidationFailures,
  filterOutEntityFailures,
} from '@/lib/bulk-upload-helpers'

export const POST = withApiLogging(async (request: NextRequest) => {
  let body: unknown

  try {
    // Parse and validate body
    body = await request.json()
    const validation = validateRequestBody(bulkUploadRequestSchema, body)

    if (!validation.success) {
      const parsedErrors = parseValidationErrors(validation.error)
      logger.warn({ errorCount: parsedErrors.length }, 'bulk upload: schema validation failed')

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
    logger.info({ transactionCount: transactions.length, householdId }, 'bulk upload: starting')

    // Verify user has write access to household
    const authResult = await requireHouseholdWriteAccess(request, householdId)
    if (authResult instanceof NextResponse) return authResult

    // Check for intra-file duplicates first
    const intraFileDuplicates = checkIntraFileDuplicates(transactions)
    logger.info(
      { intraFileDuplicateCount: intraFileDuplicates.length },
      'bulk upload: intra-file duplicate check complete'
    )

    // Check for duplicates against database (single batched query)
    const dbDupStart = Date.now()
    const dbDuplicates = await checkDuplicateTransactions(db, transactions, householdId)
    logger.info(
      { dbDuplicateCount: dbDuplicates.length, durationMs: Date.now() - dbDupStart },
      'bulk upload: db duplicate check complete'
    )

    // Combine all duplicate row numbers
    const duplicateRows = new Set([
      ...intraFileDuplicates.map((d) => d.row),
      ...dbDuplicates.map((d) => d.row),
    ])

    // Separate valid from duplicate transactions, tracking original row numbers
    const validTransactionRows: number[] = []
    const validTransactions = transactions.filter((_, index) => {
      const row = index + 2 // +2 for header row and 0-index
      if (!duplicateRows.has(row)) {
        validTransactionRows.push(row)
        return true
      }
      return false
    })
    logger.info(
      { validCount: validTransactions.length, duplicateCount: duplicateRows.size },
      'bulk upload: deduplication complete'
    )

    const failures: Array<{
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

    // Create a map to track which rows have already been added as failures
    const failureRows = new Set<number>()

    // Add intra-file duplicates to failures first
    intraFileDuplicates.forEach((d) => {
      if (!failureRows.has(d.row)) {
        failures.push({
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

    // Add database duplicates to failures, but only if not already added as intra-file duplicate
    dbDuplicates.forEach((d) => {
      if (!failureRows.has(d.row)) {
        failures.push({
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

    let successfulCount = 0

    // Process valid transactions if any exist
    if (validTransactions.length > 0) {
      const txStart = Date.now()
      logger.info({ validCount: validTransactions.length }, 'bulk upload: beginning db transaction')
      try {
        const result = await db.$transaction(async (tx) => {
          // Validate all entities exist
          const entityValStart = Date.now()
          const entityValidation = await validateEntities(tx, validTransactions, householdId)
          logger.info(
            { valid: entityValidation.valid, durationMs: Date.now() - entityValStart },
            'bulk upload: entity validation complete'
          )

          if (!entityValidation.valid) {
            // Add entity validation failures
            const entityFailures = getEntityValidationFailures(
              validTransactions,
              entityValidation,
              validTransactionRows
            )
            failures.push(...entityFailures)
            logger.warn(
              { entityFailureCount: entityFailures.length },
              'bulk upload: entity validation failures found'
            )

            // Filter out transactions with entity failures
            const finalValidTransactions = filterOutEntityFailures(
              validTransactions,
              entityValidation
            )

            if (finalValidTransactions.length === 0) {
              logger.warn('bulk upload: no valid transactions remain after entity validation')
              return { count: 0 }
            }

            // Prepare final valid transactions
            const preparedTransactions = finalValidTransactions.map((t: BulkTransaction) => ({
              householdId,
              accountId: entityValidation.accountMap.get(t.account)!,
              userId: t.user ? entityValidation.userMap.get(t.user) : null,
              transactionDate: isoToUtcNoon(t.transactionDate),
              postDate: isoToUtcNoon(t.postDate || t.transactionDate),
              description: t.description,
              categoryId: entityValidation.categoryMap.get(t.category)!,
              typeId: entityValidation.typeMap.get(t.type)!,
              amount: new Decimal(parseFloat(t.amount)),
              memo: t.memo || '',
            }))

            const insertStart = Date.now()
            const insertResult = await tx.transaction.createMany({
              data: preparedTransactions,
            })
            logger.info(
              { inserted: insertResult.count, durationMs: Date.now() - insertStart },
              'bulk upload: createMany complete (partial — entity failures excluded)'
            )
            return insertResult
          }

          // All transactions are valid, prepare them
          const preparedTransactions = validTransactions.map((t: BulkTransaction) => ({
            householdId,
            accountId: entityValidation.accountMap.get(t.account)!,
            userId: t.user ? entityValidation.userMap.get(t.user) : null,
            transactionDate: isoToUtcNoon(t.transactionDate),
            postDate: isoToUtcNoon(t.postDate || t.transactionDate),
            description: t.description,
            categoryId: entityValidation.categoryMap.get(t.category)!,
            typeId: entityValidation.typeMap.get(t.type)!,
            amount: new Decimal(parseFloat(t.amount)),
            memo: t.memo || '',
          }))

          const insertStart = Date.now()
          const insertResult = await tx.transaction.createMany({
            data: preparedTransactions,
          })
          logger.info(
            { inserted: insertResult.count, durationMs: Date.now() - insertStart },
            'bulk upload: createMany complete'
          )
          return insertResult
        })

        successfulCount = result.count
        logger.info(
          { successfulCount, durationMs: Date.now() - txStart },
          'bulk upload: db transaction complete'
        )
      } catch (error: unknown) {
        // Check if it's a unique constraint violation (P2002)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // This means some transactions were duplicates that we missed
          // The error doesn't tell us which ones, so we need to handle this differently
          logger.warn({ err: error }, 'bulk upload: unique constraint violation during insert')

          // Since we can't identify which specific transactions failed in a bulk operation,
          // we'll mark all as potentially having constraint violations
          // This shouldn't happen if our duplicate detection is working properly
          validTransactions.forEach((t) => {
            const originalIndex = transactions.findIndex((orig) => orig === t)
            failures.push({
              row: originalIndex + 2,
              transaction: t,
              issues: [
                {
                  kind: 'duplicate',
                  fields: ['transactionDate', 'description', 'amount'],
                  message: 'Unique constraint violation - transaction may be duplicate',
                },
              ],
            })
          })
          successfulCount = 0
        } else {
          // Other database errors
          logger.error({ err: error }, 'bulk upload: db transaction failed')
          validTransactions.forEach((t) => {
            const originalIndex = transactions.findIndex((orig) => orig === t)
            failures.push({
              row: originalIndex + 2,
              transaction: t,
              issues: [
                {
                  kind: 'format',
                  fields: [],
                  message: error instanceof Error ? error.message : 'Processing failed',
                },
              ],
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

    logger.info(
      { total: transactions.length, successful: successfulCount, failed: failures.length },
      'bulk upload: finished'
    )
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

    return NextResponse.json({ error: 'Failed to create bulk transactions' }, { status: 500 })
  }
})
