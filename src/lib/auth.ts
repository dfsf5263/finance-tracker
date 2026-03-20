import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { twoFactor } from 'better-auth/plugins'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { sendEmailVerification } from '@/lib/email/send-verification-email'
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset-email'
import logger from '@/lib/logger'

function createAuthInstance(options: {
  appUrl: string
  betterAuthSecret: string
  databaseUrl: string
  emailEnabled: boolean
}) {
  const adapter = new PrismaPg({ connectionString: options.databaseUrl })
  const prisma = new PrismaClient({ adapter })

  return betterAuth({
    baseURL: options.appUrl,
    basePath: '/api/auth',
    secret: options.betterAuthSecret,
    trustedOrigins: [new URL(options.appUrl).origin],
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    plugins: [
      twoFactor({
        issuer: 'Finance Tracker',
      }),
    ],
    user: {
      additionalFields: {
        firstName: {
          type: 'string',
          required: true,
        },
        lastName: {
          type: 'string',
          required: true,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day (update session if older than 1 day)
    },
    emailVerification: {
      sendOnSignUp: options.emailEnabled,
      expiresIn: 60 * 60 * 24, // 24 hours
      sendVerificationEmail: async ({ user, url }) => {
        // Parse first name from the user's name field, or use a default
        const firstName = user.name?.split(' ')[0] || 'there'

        const result = await sendEmailVerification({
          to: user.email,
          firstName,
          verificationUrl: url,
        })

        if (!result.success) {
          console.error('Failed to send email verification:', result.error)
          throw new Error(`Failed to send verification email: ${result.error}`)
        }
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: options.emailEnabled,
      autoSignIn: !options.emailEnabled,
      sendResetPassword: async ({ user, url }) => {
        // Parse first name from user's name field
        const firstName = user.name?.split(' ')[0] || 'there'

        const result = await sendPasswordResetEmail({
          to: user.email,
          firstName,
          resetUrl: url,
        })

        if (!result.success) {
          console.error('Failed to send password reset email:', result.error)
          throw new Error(`Failed to send password reset email: ${result.error}`)
        }
      },
      passwordResetExpiration: 60 * 60, // 1 hour
    },
    advanced: {
      crossSubDomainCookies: {
        enabled: false,
      },
      useSecureCookies: shouldUseSecureCookies(options.appUrl),
      database: {
        generateId: false, // Let PostgreSQL generate UUIDs automatically
      },
    },
  })
}

export function shouldUseSecureCookies(appUrl: string, nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === 'production' || appUrl.startsWith('https://')
}

let authInstance: ReturnType<typeof createAuthInstance> | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}

export function getAuth(): ReturnType<typeof createAuthInstance> {
  if (authInstance) {
    return authInstance
  }

  const appUrl = requireEnv('APP_URL')
  const betterAuthSecret = requireEnv('BETTER_AUTH_SECRET')
  const databaseUrl = requireEnv('DATABASE_URL')
  const emailEnabled = !!process.env.RESEND_API_KEY

  logger.info(
    { appUrl, trustedOrigins: [new URL(appUrl).origin], emailEnabled },
    'Initializing Better Auth'
  )

  authInstance = createAuthInstance({
    appUrl,
    betterAuthSecret,
    databaseUrl,
    emailEnabled,
  })

  return authInstance
}

export type AuthInstance = ReturnType<typeof createAuthInstance>
export type Session = AuthInstance['$Infer']['Session']
export type User = AuthInstance['$Infer']['Session']['user']
