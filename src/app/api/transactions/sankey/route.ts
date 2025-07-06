import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface SankeyNode {
  name: string
  type: 'income' | 'user' | 'expense'
}

interface SankeyLink {
  source: number
  target: number
  value: number
  type: 'income' | 'expense'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const typeId = searchParams.get('typeId')

    const where: Prisma.TransactionWhereInput = {}
    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = new Date(startDate)
      if (endDate) where.transactionDate.lte = new Date(endDate)
    }
    if (typeId) {
      where.typeId = typeId
    }

    // Fetch all transactions with source, user, category, and type information
    const transactions = await db.transaction.findMany({
      where,
      include: {
        source: true,
        user: true,
        category: true,
        type: true,
      },
    })

    // Separate transactions by income/expense based on isOutflow flag
    const incomeTransactions = transactions.filter((t) => !t.type.isOutflow)
    const expenseTransactions = transactions.filter((t) => t.type.isOutflow)

    // Collect unique entities
    const incomeSources = new Set<string>()
    const expenseCategories = new Set<string>()
    const users = new Set<string>()

    // Collect income sources from income transactions
    for (const transaction of incomeTransactions) {
      incomeSources.add(transaction.source?.name || 'Unknown Source')
      users.add(transaction.user?.name || 'Unknown User')
    }

    // Collect expense categories from expense transactions
    for (const transaction of expenseTransactions) {
      expenseCategories.add(transaction.category?.name || 'Unknown Category')
      users.add(transaction.user?.name || 'Unknown User')
    }

    // Build nodes in order: income sources, users, expense categories
    const nodeMap = new Map<string, number>()
    const nodes: SankeyNode[] = []
    let nodeIndex = 0

    // Add all income sources first
    for (const source of Array.from(incomeSources).sort()) {
      nodeMap.set(`income:${source}`, nodeIndex++)
      nodes.push({ name: source, type: 'income' })
    }

    // Add all users second
    for (const user of Array.from(users).sort()) {
      nodeMap.set(`user:${user}`, nodeIndex++)
      nodes.push({ name: user, type: 'user' })
    }

    // Add all expense categories last
    for (const category of Array.from(expenseCategories).sort()) {
      nodeMap.set(`expense:${category}`, nodeIndex++)
      nodes.push({ name: category, type: 'expense' })
    }

    // Track links with aggregated values
    const linkMap = new Map<string, { value: number; type: 'income' | 'expense' }>()

    // Process income transactions: income source -> user
    for (const transaction of incomeTransactions) {
      const sourceName = transaction.source?.name || 'Unknown Source'
      const userName = transaction.user?.name || 'Unknown User'

      const sourceIndex = nodeMap.get(`income:${sourceName}`)!
      const userIndex = nodeMap.get(`user:${userName}`)!

      const linkKey = `${sourceIndex}-${userIndex}`
      const amount = Math.abs(parseFloat(transaction.amount.toString()))

      const existing = linkMap.get(linkKey)
      linkMap.set(linkKey, {
        value: (existing?.value || 0) + amount,
        type: 'income',
      })
    }

    // Process expense transactions: user -> expense category
    for (const transaction of expenseTransactions) {
      const userName = transaction.user?.name || 'Unknown User'
      const categoryName = transaction.category?.name || 'Unknown Category'

      const userIndex = nodeMap.get(`user:${userName}`)!
      const categoryIndex = nodeMap.get(`expense:${categoryName}`)!

      const linkKey = `${userIndex}-${categoryIndex}`
      const amount = Math.abs(parseFloat(transaction.amount.toString()))

      const existing = linkMap.get(linkKey)
      linkMap.set(linkKey, {
        value: (existing?.value || 0) + amount,
        type: 'expense',
      })
    }

    // Convert link map to array
    const links: SankeyLink[] = []
    linkMap.forEach((data, key) => {
      const [source, target] = key.split('-').map(Number)
      links.push({ source, target, value: data.value, type: data.type })
    })

    return NextResponse.json({ nodes, links })
  } catch (error) {
    console.error('Error fetching sankey data:', error)
    return NextResponse.json({ error: 'Failed to fetch sankey data' }, { status: 500 })
  }
}
