import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

interface EnsureUserResult {
  user: {
    id: string
    clerkUserId: string
    email: string
    firstName: string | null
    lastName: string | null
    createdAt: Date
    updatedAt: Date
  }
  created: boolean
}

/**
 * Ensures a user record exists in the database for the authenticated Clerk user.
 * If the user record doesn't exist, it creates one using data from Clerk.
 *
 * @returns Promise<EnsureUserResult> - The user record and whether it was created
 * @throws Error if user is not authenticated or if there's a database error
 */
export async function ensureUser(): Promise<EnsureUserResult> {
  // Get the authenticated user from Clerk
  const { userId } = await auth()
  if (!userId) {
    throw new Error('Unauthorized - no authenticated user')
  }

  // First, try to find the user in our database
  let user = await db.user.findUnique({
    where: { clerkUserId: userId },
  })

  // If user exists, return it
  if (user) {
    return { user, created: false }
  }

  // User doesn't exist in database, get full user data from Clerk
  const clerkUser = await currentUser()
  if (!clerkUser) {
    throw new Error('Unable to fetch user data from Clerk')
  }

  // Get primary email address
  const primaryEmailAddress = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  )

  if (!primaryEmailAddress) {
    throw new Error('No primary email address found for user')
  }

  // Create user record in database
  try {
    user = await db.user.create({
      data: {
        clerkUserId: userId,
        email: primaryEmailAddress.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      },
    })

    return { user, created: true }
  } catch (error) {
    // Handle the case where user might have been created between our check and create
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      // Unique constraint violation - user was created by another request
      user = await db.user.findUnique({
        where: { clerkUserId: userId },
      })

      if (user) {
        return { user, created: false }
      }
    }

    throw error
  }
}
