import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'
import { randomInt, randomBytes } from 'node:crypto'

// Cryptographically secure random float in [0, 1)
function cryptoRandom(): number {
  return randomBytes(4).readUInt32BE(0) / 0x100000000
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Helper function to generate random date within a range
function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + cryptoRandom() * (end.getTime() - start.getTime()))
}

// Helper function to generate random amount
function getRandomAmount(min: number, max: number): number {
  return Math.round((cryptoRandom() * (max - min) + min) * 100) / 100
}

async function main() {
  // =========================================================================
  // Demo data — Smith & Johnson households
  // Guarded so re-runs skip creation rather than duplicating rows.
  // =========================================================================
  const existingDemo = await prisma.household.findFirst({ where: { name: 'Smith Family' } })

  let households: Awaited<ReturnType<typeof prisma.household.create>>[] = []
  let accounts: Awaited<ReturnType<typeof prisma.householdAccount.create>>[] = []
  let users: Awaited<ReturnType<typeof prisma.householdUser.create>>[] = []
  let categories: Awaited<ReturnType<typeof prisma.householdCategory.create>>[] = []
  let types: Awaited<ReturnType<typeof prisma.householdType.create>>[] = []

  if (!existingDemo) {
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

    households = [smithHousehold, johnsonHousehold]

    // Create accounts for each household
    accounts = await Promise.all([
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
    users = await Promise.all([
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
    const categoryData: { name: string; annualBudget?: number }[] = [
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

    const categories: Awaited<ReturnType<typeof prisma.householdCategory.create>>[] = []
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
    const typeData: { name: string; isOutflow: boolean }[] = [
      { name: 'Sale', isOutflow: true },
      { name: 'Income', isOutflow: false },
      { name: 'Return', isOutflow: false },
    ]

    const types: Awaited<ReturnType<typeof prisma.householdType.create>>[] = []
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
    console.log('Generating demo transactions...')
    const transactionCount = await generateTestTransactions(
      households,
      accounts,
      users,
      categories,
      types
    )

    console.log('Demo seed data created successfully!')
    console.log('Households:', households.length)
    console.log('Accounts:', accounts.length)
    console.log('Users:', users.length)
    console.log('Categories:', categories.length)
    console.log('Transaction Types:', types.length)
    console.log('Transactions:', transactionCount)
  } else {
    console.log('Demo data already exists — skipping Smith & Johnson households.')
  }

  // =========================================================================
  // E2E test user + household
  // All operations are upsert-safe — safe to re-run at any time.
  // =========================================================================
  console.log('Seeding E2E test user...')

  const e2eEmail = process.env.E2E_EMAIL ?? 'e2e@test.local'
  const e2ePassword = process.env.E2E_PASSWORD ?? 'E2eTestPassword1!'
  const e2ePasswordHash = await hashPassword(e2ePassword)

  const e2eUser = await prisma.user.upsert({
    where: { email: e2eEmail },
    create: {
      email: e2eEmail,
      name: 'E2E User',
      firstName: 'E2E',
      lastName: 'User',
      emailVerified: true,
      passwordHash: e2ePasswordHash,
    },
    update: {
      emailVerified: true,
      passwordHash: e2ePasswordHash,
    },
  })

  // Better Auth requires a credential Account row for email/password login
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: e2eUser.id } },
    create: {
      userId: e2eUser.id,
      providerId: 'credential',
      accountId: e2eUser.id,
      password: e2ePasswordHash,
    },
    update: {
      password: e2ePasswordHash,
    },
  })

  // Find or create the E2E household scoped to this user
  const existingMembership = await prisma.userHousehold.findFirst({
    where: { userId: e2eUser.id, household: { name: 'E2E Test Household' } },
    include: { household: true },
  })

  const e2eHousehold =
    existingMembership?.household ??
    (await prisma.household.create({
      data: { name: 'E2E Test Household', annualBudget: 60000 },
    }))

  // Link user to household (upsert on composite PK)
  await prisma.userHousehold.upsert({
    where: { userId_householdId: { userId: e2eUser.id, householdId: e2eHousehold.id } },
    create: { userId: e2eUser.id, householdId: e2eHousehold.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  })

  // Definitions — all use @@unique([name, householdId]) so upsert works
  const e2eAccount = await prisma.householdAccount.upsert({
    where: { name_householdId: { name: 'E2E Checking', householdId: e2eHousehold.id } },
    create: { name: 'E2E Checking', householdId: e2eHousehold.id },
    update: {},
  })

  const e2eHouseholdUser = await prisma.householdUser.upsert({
    where: { name_householdId: { name: 'E2E User', householdId: e2eHousehold.id } },
    create: { name: 'E2E User', householdId: e2eHousehold.id, annualBudget: 50000 },
    update: {},
  })

  const e2eCategoryNames = [
    { name: 'Groceries', annualBudget: 6000 },
    { name: 'Bills & Utilities', annualBudget: 12000 },
    { name: 'Food & Drink', annualBudget: 3600 },
    { name: 'Shopping', annualBudget: undefined },
    { name: 'Entertainment', annualBudget: 1200 },
    { name: 'Paycheck', annualBudget: undefined },
  ]
  const e2eCategories = await Promise.all(
    e2eCategoryNames.map((c) =>
      prisma.householdCategory.upsert({
        where: { name_householdId: { name: c.name, householdId: e2eHousehold.id } },
        create: { name: c.name, householdId: e2eHousehold.id, annualBudget: c.annualBudget },
        update: {},
      })
    )
  )

  const e2eTypeData = [
    { name: 'Sale', isOutflow: true },
    { name: 'Income', isOutflow: false },
    { name: 'Return', isOutflow: false },
  ]
  const e2eTypes = await Promise.all(
    e2eTypeData.map((t) =>
      prisma.householdType.upsert({
        where: { name_householdId: { name: t.name, householdId: e2eHousehold.id } },
        create: { name: t.name, householdId: e2eHousehold.id, isOutflow: t.isOutflow },
        update: {},
      })
    )
  )

  // Seed transactions only on first run (count check + unique constraint prevents duplication)
  const e2eTxCount = await prisma.transaction.count({ where: { householdId: e2eHousehold.id } })
  if (e2eTxCount === 0) {
    console.log('Generating E2E transactions...')
    const e2eTransactionCount = await generateTestTransactions(
      [e2eHousehold],
      [e2eAccount],
      [e2eHouseholdUser],
      e2eCategories,
      e2eTypes,
      ['Groceries', 'Bills & Utilities', 'Food & Drink', 'Entertainment']
    )
    console.log('E2E transactions created:', e2eTransactionCount)
  } else {
    console.log(`E2E transactions already exist (${e2eTxCount}) — skipping.`)
  }

  // ── Deterministic budget-test transactions ──────────────────────────────
  // These guarantee a known over-budget month (Jan 2024) and under-budget
  // month (Feb 2024) so E2E tests can assert both flows reliably.
  const entertainmentCat = e2eCategories.find((c) => c.name === 'Entertainment')!
  const groceriesCat = e2eCategories.find((c) => c.name === 'Groceries')!
  const saleType = e2eTypes.find((t) => t.name === 'Sale')!

  const budgetTestTxs = [
    // Jan 2024 — push Entertainment over its $100/month budget
    {
      description: 'Budget Test: Concert Jan',
      categoryId: entertainmentCat.id,
      typeId: saleType.id,
      amount: -75,
      transactionDate: new Date('2024-01-10'),
    },
    {
      description: 'Budget Test: Theater Jan',
      categoryId: entertainmentCat.id,
      typeId: saleType.id,
      amount: -60,
      transactionDate: new Date('2024-01-20'),
    },
    // Jan 2024 — small grocery spend (well under $500 budget)
    {
      description: 'Budget Test: Grocery Jan',
      categoryId: groceriesCat.id,
      typeId: saleType.id,
      amount: -30,
      transactionDate: new Date('2024-01-15'),
    },
    // Feb 2024 — keep everything well under budget
    {
      description: 'Budget Test: Snack Feb',
      categoryId: entertainmentCat.id,
      typeId: saleType.id,
      amount: -10,
      transactionDate: new Date('2024-02-10'),
    },
    {
      description: 'Budget Test: Grocery Feb',
      categoryId: groceriesCat.id,
      typeId: saleType.id,
      amount: -15,
      transactionDate: new Date('2024-02-15'),
    },
  ]

  for (const tx of budgetTestTxs) {
    await prisma.transaction.upsert({
      where: {
        householdId_transactionDate_description_amount: {
          householdId: e2eHousehold.id,
          transactionDate: tx.transactionDate,
          description: tx.description,
          amount: tx.amount,
        },
      },
      create: {
        householdId: e2eHousehold.id,
        accountId: e2eAccount.id,
        userId: e2eHouseholdUser.id,
        transactionDate: tx.transactionDate,
        postDate: tx.transactionDate,
        description: tx.description,
        categoryId: tx.categoryId,
        typeId: tx.typeId,
        amount: tx.amount,
      },
      update: {},
    })
  }
  console.log('Budget-test transactions upserted:', budgetTestTxs.length)

  // ── Deterministic duplicate-detection test transactions ─────────────────
  // Two transactions with the same amount and very similar descriptions on
  // consecutive days so the dedupe algorithm reliably flags them as a pair.
  const groceryDupeTxs = [
    {
      description: 'Dedupe Test: Safeway Grocery',
      categoryId: groceriesCat.id,
      typeId: saleType.id,
      amount: -67.89,
      transactionDate: new Date('2026-01-15'),
    },
    {
      description: 'Dedupe Test: Safeway Grocery',
      categoryId: groceriesCat.id,
      typeId: saleType.id,
      amount: -67.89,
      transactionDate: new Date('2026-01-16'),
    },
  ]

  for (const tx of groceryDupeTxs) {
    await prisma.transaction.upsert({
      where: {
        householdId_transactionDate_description_amount: {
          householdId: e2eHousehold.id,
          transactionDate: tx.transactionDate,
          description: tx.description,
          amount: tx.amount,
        },
      },
      create: {
        householdId: e2eHousehold.id,
        accountId: e2eAccount.id,
        userId: e2eHouseholdUser.id,
        transactionDate: tx.transactionDate,
        postDate: tx.transactionDate,
        description: tx.description,
        categoryId: tx.categoryId,
        typeId: tx.typeId,
        amount: tx.amount,
      },
      update: {},
    })
  }
  console.log('Duplicate-detection test transactions upserted:', groceryDupeTxs.length)

  console.log('E2E seed complete.')
  console.log('  User:', e2eEmail)
  console.log('  Household:', e2eHousehold.name)
}

// Generate realistic test transactions
type HouseholdRecord = { id: string }
type AccountRecord = { id: string; householdId: string }
type UserRecord = { id: string; householdId: string }
type CategoryRecord = { id: string; householdId: string; name: string }
type TypeRecord = { id: string; householdId: string; name: string; isOutflow: boolean }

async function generateTestTransactions(
  households: HouseholdRecord[],
  accounts: AccountRecord[],
  users: UserRecord[],
  categories: CategoryRecord[],
  types: TypeRecord[],
  skipCategories: string[] = []
): Promise<number> {
  const transactions: {
    householdId: string
    accountId: string
    userId: string | null
    transactionDate: Date
    postDate: Date
    description: string
    categoryId: string
    typeId: string
    amount: number
    memo: string | null
  }[] = []
  const startDate = new Date('2024-01-01')
  const endDate = new Date()

  // Transaction templates for realistic data
  const transactionTemplates: {
    description: string
    categoryName: string
    minAmount: number
    maxAmount: number
    isOutflow: boolean
  }[] = [
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
    const numTransactions = randomInt(300, 501)

    for (let i = 0; i < numTransactions; i++) {
      const template = transactionTemplates[randomInt(0, transactionTemplates.length)]
      const category = householdCategories.find((c) => c.name === template.categoryName)

      if (!category || skipCategories.includes(template.categoryName)) continue

      const account = householdAccounts[randomInt(0, householdAccounts.length)]
      const user = cryptoRandom() > 0.3 ? householdUsers[randomInt(0, householdUsers.length)] : null
      const transactionDate = getRandomDate(startDate, endDate)
      const postDate = new Date(
        transactionDate.getTime() + cryptoRandom() * 3 * 24 * 60 * 60 * 1000
      ) // 0-3 days after transaction
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
        memo: cryptoRandom() > 0.8 ? 'Auto-generated test transaction' : null,
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
