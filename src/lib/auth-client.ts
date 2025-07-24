import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins'
import type { auth } from '@/lib/auth'
import type { Session, User } from '@/lib/auth'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        // Use a small delay to ensure any competing redirects are handled
        setTimeout(() => {
          window.location.href = '/two-factor'
        }, 100)
      },
    }),
  ],
})

export type { Session, User }
