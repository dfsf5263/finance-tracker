import { z, ZodError } from 'zod'

// Transaction validation schemas
export const transactionUpdateSchema = z.object({
  accountId: z.string().uuid('Invalid account ID format'),
  userId: z.string().uuid('Invalid user ID format').nullable(),
  transactionDate: z
    .string()
    .refine(
      (val) => /^\d{4}-\d{2}-\d{2}$/.test(val) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val),
      'Invalid transaction date format'
    ),
  postDate: z
    .string()
    .refine(
      (val) => /^\d{4}-\d{2}-\d{2}$/.test(val) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val),
      'Invalid post date format'
    ),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  categoryId: z.string().uuid('Invalid category ID format'),
  typeId: z.string().uuid('Invalid type ID format'),
  amount: z
    .union([z.string(), z.number()])
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) !== 0,
      'Amount must be a valid non-zero number'
    ),
  memo: z.string().max(1000, 'Memo too long').optional(),
})

export const transactionCreateSchema = transactionUpdateSchema.extend({
  householdId: z.string().uuid('Invalid household ID format'),
})

// Household validation schemas
export const householdCreateSchema = z.object({
  name: z.string().min(1, 'Household name is required').max(100, 'Household name too long'),
  description: z.string().max(500, 'Description too long').optional(),
})

export const householdUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Household name is required')
    .max(100, 'Household name too long')
    .optional(),
  description: z.string().max(500, 'Description too long').optional(),
})

// Account validation schemas
export const accountCreateSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100, 'Account name too long'),
  householdId: z.string().uuid('Invalid household ID format'),
})

export const accountUpdateSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100, 'Account name too long').optional(),
})

// Category validation schemas
export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Category name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  icon: z.string().max(50, 'Icon name too long').optional(),
  color: z.string().max(20, 'Color value too long').optional(),
})

export const categoryUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .optional(),
  description: z.string().max(500, 'Description too long').optional(),
  icon: z.string().max(50, 'Icon name too long').optional(),
  color: z.string().max(20, 'Color value too long').optional(),
})

// User validation schemas
export const userUpdateSchema = z.object({
  firstName: z.string().max(100, 'First name too long').optional(),
  lastName: z.string().max(100, 'Last name too long').optional(),
  email: z.string().email('Invalid email format').optional(),
})

// Invitation validation schemas
export const invitationCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.enum(['ADMIN', 'MEMBER'], 'Invalid role'),
  householdId: z.string().uuid('Invalid household ID format'),
})

// Type validation schemas
export const typeCreateSchema = z.object({
  name: z.string().min(1, 'Type name is required').max(100, 'Type name too long'),
  isOutflow: z.boolean().optional(),
  householdId: z.string().uuid('Invalid household ID format'),
})

export const typeUpdateSchema = z.object({
  name: z.string().min(1, 'Type name is required').max(100, 'Type name too long').optional(),
  isOutflow: z.boolean().optional(),
})

// Query parameter validation
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .refine(
      (val) => val === undefined || (!isNaN(Number(val)) && Number(val) > 0),
      'Page must be a positive number'
    ),
  limit: z
    .string()
    .optional()
    .refine(
      (val) => val === undefined || (!isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 100),
      'Limit must be a positive number up to 100'
    ),
})

export const dateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
})

// Utility function to validate request body
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.issues.map((err) => `${err.path.join('.')}: ${err.message}`)
      return { success: false, error: messages.join(', ') }
    }
    return { success: false, error: 'Invalid request data' }
  }
}

// Utility function to validate query parameters
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | string[]>
): { success: true; data: T } | { success: false; error: string } {
  try {
    // Convert array values to strings for validation
    const sanitizedParams = Object.entries(params).reduce(
      (acc, [key, value]) => {
        acc[key] = Array.isArray(value) ? value[0] : value
        return acc
      },
      {} as Record<string, string>
    )

    const result = schema.parse(sanitizedParams)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.issues.map((err) => `${err.path.join('.')}: ${err.message}`)
      return { success: false, error: messages.join(', ') }
    }
    return { success: false, error: 'Invalid query parameters' }
  }
}
