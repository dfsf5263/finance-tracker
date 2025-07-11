import { z } from 'zod'
import { sanitizeText, isValidAmount, reasonableAmount } from './sanitizers'

// Enhanced transaction schema for bulk uploads
export const bulkTransactionSchema = z.object({
  account: z
    .string()
    .min(1, 'Account is required')
    .max(100, 'Account name too long')
    .regex(/^[a-zA-Z0-9\s\-_&'.]+$/, 'Account name contains invalid characters')
    .transform((str) => str.trim()),

  user: z
    .string()
    .max(100, 'User name too long')
    .regex(/^[a-zA-Z0-9\s\-_'.]*$/, 'User name contains invalid characters')
    .transform((str) => str.trim())
    .optional(),

  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((dateString) => {
      try {
        const date = new Date(dateString)
        return !isNaN(date.getTime()) && date.toISOString().startsWith(dateString)
      } catch {
        return false
      }
    }, 'Invalid date')
    .refine((dateString) => {
      const date = new Date(dateString)
      return date <= new Date()
    }, 'Transaction date cannot be in the future')
    .refine((dateString) => {
      const date = new Date(dateString)
      return date.getFullYear() > 1900
    }, 'Transaction date must be after 1900')
    .transform((dateString) => {
      // Convert date-only string to ISO DateTime for Prisma
      return new Date(dateString + 'T00:00:00.000Z').toISOString()
    }),

  postDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((dateString) => {
      try {
        const date = new Date(dateString)
        return !isNaN(date.getTime()) && date.toISOString().startsWith(dateString)
      } catch {
        return false
      }
    }, 'Invalid date')
    .transform((dateString) => {
      // Convert date-only string to ISO DateTime for Prisma
      return new Date(dateString + 'T00:00:00.000Z').toISOString()
    })
    .optional(),

  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description too long')
    .transform(sanitizeText), // Remove potential XSS/SQL injection

  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category name too long')
    .regex(/^[a-zA-Z0-9\s\-_&]+$/, 'Category name contains invalid characters')
    .transform((str) => str.trim()),

  type: z
    .string()
    .min(1, 'Type is required')
    .max(50, 'Type name too long')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Type name contains invalid characters')
    .transform((str) => str.trim()),

  amount: z
    .string()
    .transform((str) => str.replace(/[$,]/g, ''))
    .refine(isValidAmount, 'Invalid amount')
    .refine(reasonableAmount, 'Amount must be between -1,000,000 and 1,000,000'),

  memo: z.string().max(1000, 'Memo too long').transform(sanitizeText).optional(),
})

// Main bulk upload schema
export const bulkUploadRequestSchema = z.object({
  householdId: z.string().uuid('Invalid household ID'),
  transactions: z
    .array(bulkTransactionSchema)
    .min(1, 'At least one transaction required')
    .max(5000, 'Maximum 5000 transactions per upload'),
})

// Type exports
export type BulkTransaction = z.infer<typeof bulkTransactionSchema>
export type BulkUploadRequest = z.infer<typeof bulkUploadRequestSchema>
