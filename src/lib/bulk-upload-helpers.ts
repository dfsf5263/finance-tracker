import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/client'
import type { Prisma } from '@prisma/client'
import { prismaDateToISO } from '@/lib/date-utils'
import type { BulkTransaction } from '@/lib/validation/bulk-upload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntraFileDuplicate {
  row: number
  transaction: BulkTransaction
  duplicateRows: number[]
}

export interface DatabaseDuplicate {
  row: number
  transaction: BulkTransaction
  existingTransaction: {
    createdAt: string
    account: string
    amount: string
    description: string
    transactionDate: string
  }
}

export interface EntityValidationResult {
  valid: boolean
  error?: string
  accountMap: Map<string, string>
  userMap: Map<string, string>
  categoryMap: Map<string, string>
  typeMap: Map<string, string>
}

export interface EntityValidationFailure {
  row: number
  transaction: BulkTransaction
  issues: Array<{ kind: 'entity'; fields: string[]; message: string }>
}

export interface ValidationError {
  row: number
  field: string
  value: string
  message: string
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Convert an ISO date string (YYYY-MM-DD) to a Date at UTC noon.
 * Using midnight UTC causes PostgreSQL to shift the DATE one day behind when the
 * pg session timezone is west of UTC (e.g. America/New_York). Noon UTC is safely
 * within the same calendar day for every UTC offset (-12 … +14).
 */
export function isoToUtcNoon(iso: string): Date {
  return new Date(`${iso.split('T')[0]}T12:00:00.000Z`)
}

/**
 * Parse Zod validation error strings into structured ValidationError objects.
 */
export function parseValidationErrors(errorString: string): ValidationError[] {
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

/**
 * Detect transactions that appear more than once within the same upload file.
 * Uses the same composite key as the DB unique constraint:
 * transactionDate | description | amount.
 */
export function checkIntraFileDuplicates(transactions: BulkTransaction[]): IntraFileDuplicate[] {
  const duplicates: IntraFileDuplicate[] = []
  const seen = new Map<string, number[]>()

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]
    const key = `${t.transactionDate}|${t.description}|${t.amount}`

    if (seen.has(key)) {
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

/**
 * Build per-transaction entity-validation failures from the entity maps.
 */
export function getEntityValidationFailures(
  transactions: BulkTransaction[],
  entityValidation: EntityValidationResult,
  originalRows?: number[]
): EntityValidationFailure[] {
  const failures: EntityValidationFailure[] = []

  transactions.forEach((transaction, index) => {
    const issues: Array<{ kind: 'entity'; fields: string[]; message: string }> = []

    if (!entityValidation.accountMap.has(transaction.account)) {
      issues.push({
        kind: 'entity',
        fields: ['account'],
        message: `Account "${transaction.account}" is not defined`,
      })
    }
    if (transaction.user && !entityValidation.userMap.has(transaction.user)) {
      issues.push({
        kind: 'entity',
        fields: ['user'],
        message: `User "${transaction.user}" is not defined`,
      })
    }
    if (!entityValidation.categoryMap.has(transaction.category)) {
      issues.push({
        kind: 'entity',
        fields: ['category'],
        message: `Category "${transaction.category}" is not defined`,
      })
    }
    if (!entityValidation.typeMap.has(transaction.type)) {
      issues.push({
        kind: 'entity',
        fields: ['type'],
        message: `Type "${transaction.type}" is not defined`,
      })
    }

    if (issues.length > 0) {
      failures.push({
        row: originalRows ? originalRows[index] : index + 2,
        transaction,
        issues,
      })
    }
  })

  return failures
}

/**
 * Return only transactions whose entities all resolve successfully.
 */
export function filterOutEntityFailures(
  transactions: BulkTransaction[],
  entityValidation: EntityValidationResult
): BulkTransaction[] {
  return transactions.filter((transaction) => {
    const hasValidAccount = entityValidation.accountMap.has(transaction.account)
    const hasValidUser = !transaction.user || entityValidation.userMap.has(transaction.user)
    const hasValidCategory = entityValidation.categoryMap.has(transaction.category)
    const hasValidType = entityValidation.typeMap.has(transaction.type)

    return hasValidAccount && hasValidUser && hasValidCategory && hasValidType
  })
}

// ---------------------------------------------------------------------------
// DB-dependent helpers
// ---------------------------------------------------------------------------

/**
 * Check for duplicate transactions against the database using a single batched
 * OR query (avoids N+1 performance issues).
 */
export async function checkDuplicateTransactions(
  transactions: BulkTransaction[],
  householdId: string
): Promise<DatabaseDuplicate[]> {
  if (transactions.length === 0) return []

  // Build a deduplicated set of conditions to keep the OR query compact.
  type ConditionEntry = { transactionDate: Date; amount: Decimal; description: string }
  const uniqueConditions = new Map<string, ConditionEntry>()

  for (const t of transactions) {
    const dateKey = t.transactionDate.split('T')[0]
    const amountKey = parseFloat(t.amount).toFixed(2)
    const key = `${dateKey}|${amountKey}|${t.description}`
    if (!uniqueConditions.has(key)) {
      uniqueConditions.set(key, {
        transactionDate: isoToUtcNoon(t.transactionDate),
        amount: new Decimal(parseFloat(t.amount)),
        description: t.description,
      })
    }
  }

  // Single DB query for all candidate duplicates
  const orConditions = [...uniqueConditions.values()].map((c) => ({
    householdId,
    transactionDate: c.transactionDate,
    amount: c.amount,
    description: c.description,
  }))

  const existingRows = await db.transaction.findMany({
    where: { OR: orConditions },
    select: {
      createdAt: true,
      amount: true,
      description: true,
      transactionDate: true,
      account: {
        select: { name: true },
      },
    },
  })

  // Build an in-memory lookup from the results
  type ExistingRow = (typeof existingRows)[0]
  const existingMap = new Map<string, ExistingRow>()
  for (const ex of existingRows) {
    const dateKey = prismaDateToISO(ex.transactionDate)
    const amountKey = parseFloat(ex.amount.toString()).toFixed(2)
    const key = `${dateKey}|${amountKey}|${ex.description}`
    existingMap.set(key, ex)
  }

  // Match each incoming transaction against the lookup
  const duplicates: DatabaseDuplicate[] = []
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]
    const dateKey = t.transactionDate.split('T')[0]
    const amountKey = parseFloat(t.amount).toFixed(2)
    const key = `${dateKey}|${amountKey}|${t.description}`
    const existing = existingMap.get(key)
    if (existing) {
      duplicates.push({
        row: i + 2,
        transaction: t,
        existingTransaction: {
          createdAt: existing.createdAt.toISOString(),
          account: existing.account.name,
          amount: existing.amount.toString(),
          description: existing.description,
          transactionDate: prismaDateToISO(existing.transactionDate),
        },
      })
    }
  }

  return duplicates
}

/**
 * Validate that every referenced entity (account, user, category, type) exists
 * in the given household. Returns name→id maps for all entity types.
 */
export async function validateEntities(
  tx: Prisma.TransactionClient,
  transactions: BulkTransaction[],
  householdId: string
): Promise<EntityValidationResult> {
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
