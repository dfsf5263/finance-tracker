import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create sources
  const sources = await Promise.all([
    prisma.source.upsert({
      where: { name: 'Chase Bank' },
      update: {},
      create: { name: 'Chase Bank' },
    }),
    prisma.source.upsert({
      where: { name: 'Wells Fargo' },
      update: {},
      create: { name: 'Wells Fargo' },
    }),
    prisma.source.upsert({
      where: { name: 'Cash' },
      update: {},
      create: { name: 'Cash' },
    }),
  ])

  // Create users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { name: 'John Doe' },
      update: {},
      create: { name: 'John Doe' },
    }),
    prisma.user.upsert({
      where: { name: 'Jane Smith' },
      update: {},
      create: { name: 'Jane Smith' },
    }),
  ])

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Food & Dining' },
      update: {},
      create: { name: 'Food & Dining' },
    }),
    prisma.category.upsert({
      where: { name: 'Transportation' },
      update: {},
      create: { name: 'Transportation' },
    }),
    prisma.category.upsert({
      where: { name: 'Shopping' },
      update: {},
      create: { name: 'Shopping' },
    }),
    prisma.category.upsert({
      where: { name: 'Entertainment' },
      update: {},
      create: { name: 'Entertainment' },
    }),
    prisma.category.upsert({
      where: { name: 'Bills & Utilities' },
      update: {},
      create: { name: 'Bills & Utilities' },
    }),
    prisma.category.upsert({
      where: { name: 'Healthcare' },
      update: {},
      create: { name: 'Healthcare' },
    }),
    prisma.category.upsert({
      where: { name: 'Education' },
      update: {},
      create: { name: 'Education' },
    }),
    prisma.category.upsert({
      where: { name: 'Travel' },
      update: {},
      create: { name: 'Travel' },
    }),
    prisma.category.upsert({
      where: { name: 'Income' },
      update: {},
      create: { name: 'Income' },
    }),
    prisma.category.upsert({
      where: { name: 'Other' },
      update: {},
      create: { name: 'Other' },
    }),
  ])

  // Create transaction types
  const types = await Promise.all([
    prisma.transactionType.upsert({
      where: { name: 'Credit' },
      update: {},
      create: { name: 'Credit' },
    }),
    prisma.transactionType.upsert({
      where: { name: 'Debit' },
      update: {},
      create: { name: 'Debit' },
    }),
    prisma.transactionType.upsert({
      where: { name: 'Transfer' },
      update: {},
      create: { name: 'Transfer' },
    }),
  ])

  console.log('Seed data created successfully!')
  console.log('Sources:', sources.length)
  console.log('Users:', users.length)
  console.log('Categories:', categories.length)
  console.log('Transaction Types:', types.length)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
