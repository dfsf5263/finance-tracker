import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface SankeyNode {
  name: string
}

interface SankeyLink {
  source: number
  target: number
  value: number
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

    // Fetch all transactions with source, user, and category information
    const transactions = await db.transaction.findMany({
      where,
      include: {
        source: true,
        user: true,
        category: true,
      },
    })

    // First pass: collect unique sources, users, and categories
    const sources = new Set<string>()
    const users = new Set<string>()
    const categories = new Set<string>()

    for (const transaction of transactions) {
      sources.add(transaction.source?.name || 'Unknown Source')
      users.add(transaction.user?.name || 'Unknown User')
      categories.add(transaction.category?.name || 'Unknown Category')
    }

    // Build nodes in correct order: sources, then users, then categories
    const nodeMap = new Map<string, number>()
    const nodes: SankeyNode[] = []
    let nodeIndex = 0

    // Add all sources first
    for (const source of Array.from(sources).sort()) {
      nodeMap.set(`source:${source}`, nodeIndex++)
      nodes.push({ name: source })
    }

    // Add all users second
    for (const user of Array.from(users).sort()) {
      nodeMap.set(`user:${user}`, nodeIndex++)
      nodes.push({ name: user })
    }

    // Add all categories last
    for (const category of Array.from(categories).sort()) {
      nodeMap.set(`category:${category}`, nodeIndex++)
      nodes.push({ name: category })
    }

    // Track links with aggregated values
    const linkMap = new Map<string, number>()

    // Second pass: process transactions to create links
    for (const transaction of transactions) {
      const sourceName = transaction.source?.name || 'Unknown Source'
      const userName = transaction.user?.name || 'Unknown User'
      const categoryName = transaction.category?.name || 'Unknown Category'

      // Get node indices
      const sourceIndex = nodeMap.get(`source:${sourceName}`)!
      const userIndex = nodeMap.get(`user:${userName}`)!
      const categoryIndex = nodeMap.get(`category:${categoryName}`)!

      // Create link keys
      const sourceToUserKey = `${sourceIndex}-${userIndex}`
      const userToCategoryKey = `${userIndex}-${categoryIndex}`

      // Aggregate values
      const amount = Math.abs(parseFloat(transaction.amount.toString()))

      linkMap.set(sourceToUserKey, (linkMap.get(sourceToUserKey) || 0) + amount)
      linkMap.set(userToCategoryKey, (linkMap.get(userToCategoryKey) || 0) + amount)
    }

    // Convert link map to array
    const links: SankeyLink[] = []
    linkMap.forEach((value, key) => {
      const [source, target] = key.split('-').map(Number)
      links.push({ source, target, value })
    })

    return NextResponse.json({ nodes, links })
  } catch (error) {
    console.error('Error fetching sankey data:', error)
    return NextResponse.json({ error: 'Failed to fetch sankey data' }, { status: 500 })
  }
}
