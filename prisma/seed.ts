import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create households
  const households = await Promise.all([
    prisma.household.upsert({
      where: { name: 'Smith Family' },
      update: {},
      create: {
        name: 'Smith Family',
        annualBudget: 85000,
      },
    }),
    prisma.household.upsert({
      where: { name: 'Johnson Family' },
      update: {},
      create: {
        name: 'Johnson Family',
        annualBudget: 75000,
      },
    }),
  ])

  const smithHousehold = households[0]
  const johnsonHousehold = households[1]

  // Create accounts for each household
  const accounts = await Promise.all([
    // Smith Family accounts
    prisma.householdAccount.upsert({
      where: {
        name_householdId: { name: 'Chase Sapphire Preferred', householdId: smithHousehold.id },
      },
      update: {},
      create: {
        name: 'Chase Sapphire Preferred',
        householdId: smithHousehold.id,
      },
    }),
    prisma.householdAccount.upsert({
      where: { name_householdId: { name: 'Wells Fargo Checking', householdId: smithHousehold.id } },
      update: {},
      create: {
        name: 'Wells Fargo Checking',
        householdId: smithHousehold.id,
      },
    }),
    // Johnson Family accounts
    prisma.householdAccount.upsert({
      where: {
        name_householdId: { name: 'Bank of America Rewards', householdId: johnsonHousehold.id },
      },
      update: {},
      create: {
        name: 'Bank of America Rewards',
        householdId: johnsonHousehold.id,
      },
    }),
    prisma.householdAccount.upsert({
      where: {
        name_householdId: { name: 'Credit Union Savings', householdId: johnsonHousehold.id },
      },
      update: {},
      create: {
        name: 'Credit Union Savings',
        householdId: johnsonHousehold.id,
      },
    }),
  ])

  // Create users for each household
  const users = await Promise.all([
    // Smith Family users
    prisma.householdUser.upsert({
      where: { name_householdId: { name: 'Chris', householdId: smithHousehold.id } },
      update: {},
      create: {
        name: 'Chris',
        householdId: smithHousehold.id,
        annualBudget: 25000,
      },
    }),
    prisma.householdUser.upsert({
      where: { name_householdId: { name: 'Steph', householdId: smithHousehold.id } },
      update: {},
      create: {
        name: 'Steph',
        householdId: smithHousehold.id,
        annualBudget: 20000,
      },
    }),
    // Johnson Family users
    prisma.householdUser.upsert({
      where: { name_householdId: { name: 'Mike', householdId: johnsonHousehold.id } },
      update: {},
      create: {
        name: 'Mike',
        householdId: johnsonHousehold.id,
        annualBudget: 30000,
      },
    }),
    prisma.householdUser.upsert({
      where: { name_householdId: { name: 'Sarah', householdId: johnsonHousehold.id } },
      update: {},
      create: {
        name: 'Sarah',
        householdId: johnsonHousehold.id,
        annualBudget: 15000,
      },
    }),
  ])

  // Create categories for each household
  const categoryData = [
    { name: 'Groceries', annualBudget: 6000 },
    { name: 'Travel', annualBudget: 3000 },
    { name: 'Health & Wellness', annualBudget: 2400 },
    { name: 'Shopping' },
    { name: 'Food & Drink', annualBudget: 4800 },
    { name: 'Gas', annualBudget: 1800 },
    { name: 'Personal' },
    { name: 'Other' },
    { name: 'Bills & Utilities', annualBudget: 24000 },
    { name: 'Entertainment', annualBudget: 1200 },
    { name: 'Automotive' },
    { name: 'Professional Services' },
    { name: 'Dogs' },
    { name: 'Refund' },
    { name: 'Gift' },
    { name: 'Home Maintenance' },
    { name: 'Subscriptions' },
    { name: 'Car Maintenance' },
    { name: 'Work Lunch' },
    { name: 'Business' },
    { name: 'Paycheck' },
  ]

  const categories = []
  for (const household of households) {
    for (const categoryInfo of categoryData) {
      const category = await prisma.householdCategory.upsert({
        where: { name_householdId: { name: categoryInfo.name, householdId: household.id } },
        update: {},
        create: {
          name: categoryInfo.name,
          householdId: household.id,
          annualBudget: categoryInfo.annualBudget,
        },
      })
      categories.push(category)
    }
  }

  // Create transaction types for each household
  const typeData = [
    { name: 'Sale', isOutflow: true },
    { name: 'Income', isOutflow: false },
    { name: 'Return', isOutflow: false },
  ]

  const types = []
  for (const household of households) {
    for (const typeInfo of typeData) {
      const type = await prisma.householdType.upsert({
        where: { name_householdId: { name: typeInfo.name, householdId: household.id } },
        update: {},
        create: {
          name: typeInfo.name,
          householdId: household.id,
          isOutflow: typeInfo.isOutflow,
        },
      })
      types.push(type)
    }
  }

  console.log('Seed data created successfully!')
  console.log('Households:', households.length)
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
