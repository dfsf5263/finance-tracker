import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { twoFactor } from 'better-auth/plugins'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { sendEmailVerification } from '@/lib/email/send-verification-email'
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset-email'
import logger from '@/lib/logger'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL environment variable is required')
}

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET environment variable is required')
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL
const trustedOrigins = [new URL(appUrl).origin]
const emailEnabled = !!process.env.RESEND_API_KEY

logger.info({ appUrl, trustedOrigins, emailEnabled }, 'Initializing Better Auth')

export const auth = betterAuth({
  baseURL: appUrl,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins,
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
    sendOnSignUp: emailEnabled,
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
    requireEmailVerification: emailEnabled,
    autoSignIn: !emailEnabled,
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
    useSecureCookies: process.env.NODE_ENV === 'production',
    database: {
      generateId: false, // Let PostgreSQL generate UUIDs automatically
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
