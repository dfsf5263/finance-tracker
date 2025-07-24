import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { twoFactor } from 'better-auth/plugins'
import { PrismaClient } from '@prisma/client'
import { sendEmailVerification } from '@/lib/email/send-verification-email'
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset-email'

const prisma = new PrismaClient()

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: ['https://finance.crowland.us', 'http://localhost:3000'],
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
    sendOnSignUp: true,
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
    requireEmailVerification: true,
    autoSignIn: false, // Don't auto sign in until email is verified
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
