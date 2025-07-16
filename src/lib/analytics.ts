import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export interface AnalyticsOptions {
  householdId: string
  startDate?: string
  endDate?: string
  groupBy?: 'category' | 'user' | 'account'
  typeId?: string
}

export interface AnalyticsResult {
  name: string
  value: number
  count: number
}

export async function getTransactionAnalytics(
  options: AnalyticsOptions
): Promise<AnalyticsResult[]> {
  const { householdId, startDate, endDate, groupBy = 'category', typeId } = options

  const where: Prisma.TransactionWhereInput = {
    householdId: householdId,
  }

  if (startDate || endDate) {
    where.transactionDate = {}
    if (startDate) where.transactionDate.gte = new Date(startDate)
    if (endDate) where.transactionDate.lte = new Date(endDate)
  }

  if (typeId) {
    where.typeId = typeId
  }

  const groupByField =
    groupBy === 'user' ? 'userId' : groupBy === 'account' ? 'accountId' : 'categoryId'

  const aggregations = await db.transaction.groupBy({
    by: [groupByField as 'userId' | 'accountId' | 'categoryId'],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      _all: true,
    },
  })

  // Get the actual names for the IDs
  const ids = aggregations
    .map((item) => item[groupByField])
    .filter((id): id is string => id !== null)

  let nameMap: { [key: string]: string } = {}
  if (groupBy === 'user') {
    const users = await db.householdUser.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    nameMap = Object.fromEntries(users.map((user) => [user.id, user.name]))
  } else if (groupBy === 'account') {
    const accounts = await db.householdAccount.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    nameMap = Object.fromEntries(accounts.map((account) => [account.id, account.name]))
  } else {
    const categories = await db.householdCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    nameMap = Object.fromEntries(categories.map((category) => [category.id, category.name]))
  }

  const formattedData = aggregations.map((item) => ({
    name: nameMap[item[groupByField] as string] || (groupBy === 'user' ? 'Household' : 'Unknown'),
    value: parseFloat(item._sum.amount?.toString() || '0'),
    count: item._count._all,
  }))

  return formattedData
}

export async function hasTransactionsInPeriod(
  householdId: string,
  startDate?: string,
  endDate?: string
): Promise<boolean> {
  const where: Prisma.TransactionWhereInput = {
    householdId: householdId,
  }

  if (startDate || endDate) {
    where.transactionDate = {}
    if (startDate) where.transactionDate.gte = new Date(startDate)
    if (endDate) where.transactionDate.lte = new Date(endDate)
  }

  const count = await db.transaction.count({
    where,
  })

  return count > 0
}
