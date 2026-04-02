import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins'
import { apiKeyClient } from '@better-auth/api-key/client'
import type { AuthInstance } from '@/lib/auth'
import type { Session, User } from '@/lib/auth'

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<AuthInstance>(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        // Use a small delay to ensure any competing redirects are handled
        setTimeout(() => {
          window.location.href = '/two-factor'
        }, 100)
      },
    }),
    apiKeyClient(),
  ],
})

export type { Session, User }
