import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

interface CSVTransaction {
  account: string
  user: string
  transactionDate: string
  postDate: string
  description: string
  category: string
  type: string
  amount: string
  memo?: string
}

interface ValidationError {
  row: number
  field: string
  value: string
  message: string
}

function parseMMDDYYYY(dateString: string): Date | null {
  if (!dateString) return null

  // Check if the date matches MM/DD/YYYY format
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  const match = dateString.match(dateRegex)

  if (!match) return null

  const month = parseInt(match[1], 10)
  const day = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  // Validate month and day ranges
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  // Create date and check if it's valid
  const date = new Date(year, month - 1, day)

  // Check if the date is valid (handles cases like Feb 30)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  return date
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactions, householdId } = body

    if (!Array.isArray(transactions)) {
      return NextResponse.json({ error: 'Transactions must be an array' }, { status: 400 })
    }

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 })
    }

    // Collect all unique names from the CSV
    const accountNames = [
      ...new Set(transactions.map((t: CSVTransaction) => t.account).filter(Boolean)),
    ]
    const userNames = [...new Set(transactions.map((t: CSVTransaction) => t.user).filter(Boolean))]
    const categoryNames = [
      ...new Set(transactions.map((t: CSVTransaction) => t.category).filter(Boolean)),
    ]
    const typeNames = [...new Set(transactions.map((t: CSVTransaction) => t.type).filter(Boolean))]

    // Fetch all entities from database for the specific household
    const [accounts, users, categories, types] = await Promise.all([
      db.householdAccount.findMany({ where: { name: { in: accountNames }, householdId } }),
      db.householdUser.findMany({ where: { name: { in: userNames }, householdId } }),
      db.householdCategory.findMany({ where: { name: { in: categoryNames }, householdId } }),
      db.householdType.findMany({ where: { name: { in: typeNames }, householdId } }),
    ])

    // Create lookup maps
    const accountMap = new Map(accounts.map((s) => [s.name, s.id]))
    const userMap = new Map(users.map((u) => [u.name, u.id]))
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]))
    const typeMap = new Map(types.map((t) => [t.name, t.id]))

    // Validate all transactions and collect errors
    const validationErrors: ValidationError[] = []
    const validTransactions = []

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i] as CSVTransaction
      const rowNumber = i + 2 // Adding 2 because row 1 is header and arrays are 0-indexed

      // Entity existence is now validated client-side
      // Keep minimal server-side validation as backup security check
      if (
        !accountMap.has(transaction.account) ||
        !userMap.has(transaction.user) ||
        !categoryMap.has(transaction.category) ||
        !typeMap.has(transaction.type)
      ) {
        validationErrors.push({
          row: rowNumber,
          field: 'entities',
          value: '',
          message:
            'One or more entities do not exist. Ensure you have defined all entities in the definitions page prior to uploading your transactions.',
        })
      }

      // Validate date formats
      const transactionDate = parseMMDDYYYY(transaction.transactionDate)
      if (!transactionDate) {
        validationErrors.push({
          row: rowNumber,
          field: 'transactionDate',
          value: transaction.transactionDate,
          message: `Invalid date format. Expected MM/DD/YYYY but got "${transaction.transactionDate}"`,
        })
      }

      const postDate = transaction.postDate ? parseMMDDYYYY(transaction.postDate) : transactionDate
      if (transaction.postDate && !postDate) {
        validationErrors.push({
          row: rowNumber,
          field: 'postDate',
          value: transaction.postDate,
          message: `Invalid date format. Expected MM/DD/YYYY but got "${transaction.postDate}"`,
        })
      }

      // Validate amount is a valid number
      const amount = parseFloat(transaction.amount)
      if (isNaN(amount)) {
        validationErrors.push({
          row: rowNumber,
          field: 'amount',
          value: transaction.amount,
          message: `Invalid amount. Expected a number but got "${transaction.amount}"`,
        })
      }

      // If no validation errors for this row, add to valid transactions
      const hasRowErrors = validationErrors.some((e) => e.row === rowNumber)
      if (!hasRowErrors && transactionDate) {
        validTransactions.push({
          householdId,
          accountId: accountMap.get(transaction.account)!,
          userId: userMap.get(transaction.user)!,
          transactionDate: transactionDate,
          postDate: postDate || transactionDate,
          description: transaction.description,
          categoryId: categoryMap.get(transaction.category)!,
          typeId: typeMap.get(transaction.type)!,
          amount: new Decimal(amount),
          memo: transaction.memo || '',
        })
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          validationErrors,
          message: `Found ${validationErrors.length} validation error(s) in the CSV file`,
        },
        { status: 400 }
      )
    }

    // Create all valid transactions
    const createdTransactions = await db.transaction.createMany({
      data: validTransactions,
      skipDuplicates: true,
    })

    return NextResponse.json({
      message: `Successfully created ${createdTransactions.count} transactions`,
      count: createdTransactions.count,
    })
  } catch (error) {
    console.error('Error creating bulk transactions:', error)
    return NextResponse.json(
      {
        error: 'Failed to create bulk transactions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
