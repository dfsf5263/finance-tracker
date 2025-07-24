import { getSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

interface EnsureUserResult {
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    emailVerified: boolean
    twoFactorEnabled: boolean | null
    createdAt: Date
    updatedAt: Date
  }
  created: boolean
}

/**
 * Ensures a user record exists in the database for the authenticated Better Auth user.
 * With Better Auth, users are created automatically during registration,
 * so this mainly serves as a compatibility layer and user fetcher.
 *
 * @returns Promise<EnsureUserResult> - The user record and whether it was created
 * @throws Error if user is not authenticated or if there's a database error
 */
export async function ensureUser(): Promise<EnsureUserResult> {
  // Get the authenticated user from Better Auth
  const session = await getSession()
  if (!session || !session.user) {
    throw new Error('Unauthorized - no authenticated user')
  }

  // Find the user in our database
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    throw new Error('User not found in database')
  }

  // With Better Auth, users are created during registration, so created is always false here
  return { user, created: false }
}
