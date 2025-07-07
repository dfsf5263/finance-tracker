import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create accounts
  const accounts = await Promise.all([
    prisma.transactionAccount.upsert({
      where: { name: 'Chase Sapphire Preferred' },
      update: {},
      create: { name: 'Chase Sapphire Preferred' },
    }),
    prisma.transactionAccount.upsert({
      where: { name: 'Wells Fargo Checking' },
      update: {},
      create: { name: 'Wells Fargo Checking' },
    }),
  ])

  // Create users
  const users = await Promise.all([
    prisma.transactionUser.upsert({
      where: { name: 'Chris' },
      update: {},
      create: { name: 'Chris' },
    }),
    prisma.transactionUser.upsert({
      where: { name: 'Steph' },
      update: {},
      create: { name: 'Steph' },
    }),
  ])

  // Create categories
  const categories = await Promise.all([
    prisma.transactionCategory.upsert({
      where: { name: 'Groceries' },
      update: {},
      create: { name: 'Groceries' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Travel' },
      update: {},
      create: { name: 'Travel' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Health & Wellness' },
      update: {},
      create: { name: 'Health & Wellness' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Shopping' },
      update: {},
      create: { name: 'Shopping' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Food & Drink' },
      update: {},
      create: { name: 'Food & Drink' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Gas' },
      update: {},
      create: { name: 'Gas' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Personal' },
      update: {},
      create: { name: 'Personal' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Other' },
      update: {},
      create: { name: 'Other' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Bills & Utilities' },
      update: {},
      create: { name: 'Bills & Utilities' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Entertainment' },
      update: {},
      create: { name: 'Entertainment' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Automotive' },
      update: {},
      create: { name: 'Automotive' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Professional Services' },
      update: {},
      create: { name: 'Professional Services' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Dogs' },
      update: {},
      create: { name: 'Dogs' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Refund' },
      update: {},
      create: { name: 'Refund' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Gift' },
      update: {},
      create: { name: 'Gift' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Home Maintenance' },
      update: {},
      create: { name: 'Home Maintenance' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Subscriptions' },
      update: {},
      create: { name: 'Subscriptions' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Car Maintenance' },
      update: {},
      create: { name: 'Car Maintenance' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Work Lunch' },
      update: {},
      create: { name: 'Work Lunch' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Business' },
      update: {},
      create: { name: 'Business' },
    }),
    prisma.transactionCategory.upsert({
      where: { name: 'Paycheck' },
      update: {},
      create: { name: 'Paycheck' },
    }),
  ])

  // Create transaction types
  const types = await Promise.all([
    prisma.transactionType.upsert({
      where: { name: 'Sale' },
      update: {},
      create: {
        name: 'Sale',
        isOutflow: true,
      },
    }),
    prisma.transactionType.upsert({
      where: { name: 'Income' },
      update: {},
      create: {
        name: 'Income',
        isOutflow: false,
      },
    }),
    prisma.transactionType.upsert({
      where: { name: 'Return' },
      update: {},
      create: {
        name: 'Return',
        isOutflow: false,
      },
    }),
  ])

  console.log('Seed data created successfully!')
  console.log('Accounts:', accounts.length)
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
