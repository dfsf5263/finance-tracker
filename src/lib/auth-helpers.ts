import { getAuth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * Get the current session from the request
 */
export async function getSession() {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  })
  return session
}
