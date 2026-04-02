---
description: "Use when working on Zod validation schemas, request validation, or form validation. Covers schema patterns and validation helpers."
applyTo: "src/lib/validation*"
---

# Validation Standards

## Framework

All validation uses **Zod 4** schemas defined in `src/lib/validation.ts`.

## Schema Patterns

```ts
import { z } from 'zod'

export const entityCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  householdId: z.uuidv4({ error: 'Invalid household ID format' }),
  amount: z.number().or(z.string().transform(Number)),
})

export const entityUpdateSchema = entityCreateSchema.partial().extend({
  id: z.uuidv4({ error: 'Invalid ID format' }),
})
```

## Conventions

- All string fields: set `min(1)` for required, `max()` for length limits
- IDs: always `z.uuidv4({ error: '...' })` (Zod 4 — more precise than `z.string().uuid()`)
- Amounts: accept both `number` and string-to-number transforms
- Dates: validate as ISO strings
- Pagination: constrain page (min 1) and pageSize (1-1000)

## Server-Side Validation

Use the helper functions in API route handlers:

```ts
import { validateRequestBody, validateQueryParams } from '@/lib/validation'

// Body validation
const validation = validateRequestBody(transactionCreateSchema, body)
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 })
}
// validation.data is typed correctly

// Query params
const paramValidation = validateQueryParams(paginationSchema, Object.fromEntries(params))
```

## Client-Side Validation

Validate form data before calling `apiFetch`. Use the same Zod schemas where possible to keep client and server validation in sync.
