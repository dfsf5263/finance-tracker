import { db } from '@/lib/db'

export interface HouseholdUser {
  id: string
  name: string
  annualBudget: string | null
}

export async function getHouseholdUsers(householdId: string): Promise<HouseholdUser[]> {
  const users = await db.householdUser.findMany({
    where: {
      householdId: householdId,
    },
    select: {
      id: true,
      name: true,
      annualBudget: true,
    },
  })

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    annualBudget: user.annualBudget?.toString() || null,
  }))
}
