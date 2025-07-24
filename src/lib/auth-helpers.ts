import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Get the current session from the request
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
}

/**
 * Require authentication for API routes
 * Returns the user if authenticated, otherwise returns an error response
 */
export async function requireAuth() {
  const session = await getSession()

  if (!session || !session.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { user: session.user }
}

/**
 * Get the database user record for the authenticated user
 */
export async function getDbUser() {
  const { user, error } = await requireAuth()

  if (error) {
    return { error }
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
  })

  if (!dbUser) {
    return {
      error: NextResponse.json({ error: 'User not found' }, { status: 404 }),
    }
  }

  return { user: dbUser }
}

/**
 * Compatibility function for routes that previously used auth() from Clerk
 * Returns userId in the same format as Clerk's auth() function
 */
export async function authCompat() {
  const session = await getSession()

  if (!session || !session.user) {
    return { userId: null }
  }

  return { userId: session.user.id }
}
