const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Helper function to generate random date within a range
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// Helper function to generate random amount
function getRandomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

async function main() {
  // Create households (removed unique constraint on name)
  const smithHousehold = await prisma.household.create({
    data: {
      name: 'Smith Family',
      annualBudget: 85000,
    },
  })

  const johnsonHousehold = await prisma.household.create({
    data: {
      name: 'Johnson Family',
      annualBudget: 75000,
    },
  })

  const households = [smithHousehold, johnsonHousehold]

  // Create accounts for each household
  const accounts = await Promise.all([
    // Smith Family accounts
    prisma.householdAccount.create({
      data: {
        name: 'Chase Sapphire Preferred',
        householdId: smithHousehold.id,
      },
    }),
    prisma.householdAccount.create({
      data: {
        name: 'Wells Fargo Checking',
        householdId: smithHousehold.id,
      },
    }),
    // Johnson Family accounts
    prisma.householdAccount.create({
      data: {
        name: 'Bank of America Rewards',
        householdId: johnsonHousehold.id,
      },
    }),
    prisma.householdAccount.create({
      data: {
        name: 'Credit Union Savings',
        householdId: johnsonHousehold.id,
      },
    }),
  ])

  // Create users for each household
  const users = await Promise.all([
    // Smith Family users
    prisma.householdUser.create({
      data: {
        name: 'Chris',
        householdId: smithHousehold.id,
        annualBudget: 25000,
      },
    }),
    prisma.householdUser.create({
      data: {
        name: 'Steph',
        householdId: smithHousehold.id,
        annualBudget: 20000,
      },
    }),
    // Johnson Family users
    prisma.householdUser.create({
      data: {
        name: 'Mike',
        householdId: johnsonHousehold.id,
        annualBudget: 30000,
      },
    }),
    prisma.householdUser.create({
      data: {
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
      const category = await prisma.householdCategory.create({
        data: {
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
      const type = await prisma.householdType.create({
        data: {
          name: typeInfo.name,
          householdId: household.id,
          isOutflow: typeInfo.isOutflow,
        },
      })
      types.push(type)
    }
  }

  // Generate comprehensive test transactions
  console.log('Generating test transactions...')
  const transactionCount = await generateTestTransactions(
    households,
    accounts,
    users,
    categories,
    types
  )

  console.log('Seed data created successfully!')
  console.log('Households:', households.length)
  console.log('Accounts:', accounts.length)
  console.log('Users:', users.length)
  console.log('Categories:', categories.length)
  console.log('Transaction Types:', types.length)
  console.log('Transactions:', transactionCount)
}

// Generate realistic test transactions
async function generateTestTransactions(households, accounts, users, categories, types) {
  const transactions = []
  const startDate = new Date('2024-01-01')
  const endDate = new Date()

  // Transaction templates for realistic data
  const transactionTemplates = [
    // Groceries
    {
      description: 'Whole Foods Market',
      categoryName: 'Groceries',
      minAmount: 45,
      maxAmount: 180,
      isOutflow: true,
    },
    {
      description: 'Safeway Grocery',
      categoryName: 'Groceries',
      minAmount: 25,
      maxAmount: 120,
      isOutflow: true,
    },
    {
      description: 'Costco Wholesale',
      categoryName: 'Groceries',
      minAmount: 80,
      maxAmount: 300,
      isOutflow: true,
    },

    // Food & Drink
    {
      description: 'Starbucks Coffee',
      categoryName: 'Food & Drink',
      minAmount: 4,
      maxAmount: 25,
      isOutflow: true,
    },
    {
      description: 'Local Restaurant',
      categoryName: 'Food & Drink',
      minAmount: 15,
      maxAmount: 85,
      isOutflow: true,
    },
    {
      description: 'Pizza Delivery',
      categoryName: 'Food & Drink',
      minAmount: 18,
      maxAmount: 45,
      isOutflow: true,
    },

    // Gas
    {
      description: 'Shell Gas Station',
      categoryName: 'Gas',
      minAmount: 35,
      maxAmount: 75,
      isOutflow: true,
    },
    {
      description: 'Chevron Fuel',
      categoryName: 'Gas',
      minAmount: 30,
      maxAmount: 80,
      isOutflow: true,
    },

    // Bills & Utilities
    {
      description: 'Pacific Gas & Electric',
      categoryName: 'Bills & Utilities',
      minAmount: 120,
      maxAmount: 280,
      isOutflow: true,
    },
    {
      description: 'Comcast Internet',
      categoryName: 'Bills & Utilities',
      minAmount: 89,
      maxAmount: 150,
      isOutflow: true,
    },
    {
      description: 'Water Department',
      categoryName: 'Bills & Utilities',
      minAmount: 45,
      maxAmount: 90,
      isOutflow: true,
    },

    // Entertainment
    {
      description: 'Netflix Subscription',
      categoryName: 'Subscriptions',
      minAmount: 15,
      maxAmount: 25,
      isOutflow: true,
    },
    {
      description: 'Movie Theater',
      categoryName: 'Entertainment',
      minAmount: 12,
      maxAmount: 50,
      isOutflow: true,
    },
    {
      description: 'Concert Tickets',
      categoryName: 'Entertainment',
      minAmount: 75,
      maxAmount: 200,
      isOutflow: true,
    },

    // Travel
    {
      description: 'United Airlines',
      categoryName: 'Travel',
      minAmount: 200,
      maxAmount: 800,
      isOutflow: true,
    },
    {
      description: 'Hotel Booking',
      categoryName: 'Travel',
      minAmount: 120,
      maxAmount: 400,
      isOutflow: true,
    },
    {
      description: 'Uber Ride',
      categoryName: 'Travel',
      minAmount: 8,
      maxAmount: 35,
      isOutflow: true,
    },

    // Shopping
    {
      description: 'Amazon Purchase',
      categoryName: 'Shopping',
      minAmount: 15,
      maxAmount: 150,
      isOutflow: true,
    },
    {
      description: 'Target Store',
      categoryName: 'Shopping',
      minAmount: 25,
      maxAmount: 120,
      isOutflow: true,
    },
    {
      description: 'Apple Store',
      categoryName: 'Shopping',
      minAmount: 50,
      maxAmount: 500,
      isOutflow: true,
    },

    // Health & Wellness
    {
      description: 'CVS Pharmacy',
      categoryName: 'Health & Wellness',
      minAmount: 12,
      maxAmount: 80,
      isOutflow: true,
    },
    {
      description: 'Gym Membership',
      categoryName: 'Health & Wellness',
      minAmount: 35,
      maxAmount: 120,
      isOutflow: true,
    },

    // Income
    {
      description: 'Salary Deposit',
      categoryName: 'Paycheck',
      minAmount: 2500,
      maxAmount: 5000,
      isOutflow: false,
    },
    {
      description: 'Bonus Payment',
      categoryName: 'Paycheck',
      minAmount: 500,
      maxAmount: 2000,
      isOutflow: false,
    },
    {
      description: 'Freelance Work',
      categoryName: 'Paycheck',
      minAmount: 200,
      maxAmount: 1500,
      isOutflow: false,
    },
  ]

  for (const household of households) {
    const householdAccounts = accounts.filter((a) => a.householdId === household.id)
    const householdUsers = users.filter((u) => u.householdId === household.id)
    const householdCategories = categories.filter((c) => c.householdId === household.id)
    const householdTypes = types.filter((t) => t.householdId === household.id)

    const saleType = householdTypes.find((t) => t.name === 'Sale')
    const incomeType = householdTypes.find((t) => t.name === 'Income')

    // Generate 300-500 transactions per household
    const numTransactions = Math.floor(Math.random() * 200) + 300

    for (let i = 0; i < numTransactions; i++) {
      const template = transactionTemplates[Math.floor(Math.random() * transactionTemplates.length)]
      const category = householdCategories.find((c) => c.name === template.categoryName)

      if (!category) continue

      const account = householdAccounts[Math.floor(Math.random() * householdAccounts.length)]
      const user =
        Math.random() > 0.3
          ? householdUsers[Math.floor(Math.random() * householdUsers.length)]
          : null
      const transactionDate = getRandomDate(startDate, endDate)
      const postDate = new Date(transactionDate.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000) // 0-3 days after transaction
      const amount = getRandomAmount(template.minAmount, template.maxAmount)
      const type = template.isOutflow ? saleType : incomeType

      if (!type) continue

      // Make outflow transactions negative
      const finalAmount = template.isOutflow ? -Math.abs(amount) : Math.abs(amount)

      const transaction = {
        householdId: household.id,
        accountId: account.id,
        userId: user?.id || null,
        transactionDate,
        postDate,
        description: template.description,
        categoryId: category.id,
        typeId: type.id,
        amount: finalAmount,
        memo: Math.random() > 0.8 ? 'Auto-generated test transaction' : null,
      }

      transactions.push(transaction)
    }
  }

  // Batch insert transactions for better performance
  const batchSize = 100
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)
    await prisma.transaction.createMany({
      data: batch,
    })
  }

  return transactions.length
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
