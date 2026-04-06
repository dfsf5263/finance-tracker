---
description: "Use when creating or modifying API route handlers in src/app/api/. Covers auth middleware, validation, error handling, and response patterns."
applyTo: "src/app/api/**"
---

# API Route Standards

## Route File Structure

All API routes live in `src/app/api/` using Next.js App Router conventions:

```
src/app/api/
├── resource/
│   ├── route.ts          # GET (list), POST (create)
│   └── [id]/
│       └── route.ts      # GET (single), PUT (update), DELETE
```

## Handler Pattern

Every exported handler must be wrapped with `withApiLogging`:

```ts
import { NextResponse } from 'next/server'
import { withApiLogging } from '@/lib/middleware/with-api-logging'
import { requireHouseholdWriteAccess } from '@/lib/auth-middleware'
import { validateRequestBody } from '@/lib/validation'
import { logApiError } from '@/lib/error-logger'
import { db } from '@/lib/db'

export const PUT = withApiLogging(async (request, { params }) => {
  const { id } = await params
  const householdId = request.nextUrl.searchParams.get('householdId')

  // 1. Auth & authorization
  const authResult = await requireHouseholdWriteAccess(request, householdId)
  if (authResult instanceof NextResponse) return authResult

  // 2. Parse & validate body
  const body = await request.json()
  const validation = validateRequestBody(schema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    // 3. Database operation
    const result = await db.model.update({
      where: { id },
      data: validation.data,
    })
    return NextResponse.json(result)
  } catch (error) {
    await logApiError({ request, error, operation: 'update-resource' })
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
})
```

## Auth Middleware

- `requireAuth()` — Returns `AuthContext { userId, user }` or 401 response
- `requireHouseholdAccess(request, householdId)` — Checks membership, returns role or 401/403
- `requireHouseholdWriteAccess(request, householdId)` — Requires OWNER or MEMBER role

Always check `if (result instanceof NextResponse) return result` after calling these.

## Validation

Use Zod schemas from `@/lib/validation`:

```ts
import { validateRequestBody, validateQueryParams } from '@/lib/validation'
```

- `validateRequestBody(schema, data)` — returns `{ success, data, error }`
- `validateQueryParams(schema, params)` — returns `{ success, data, error }`

## Error Handling

- Use `logApiError()` from `@/lib/error-logger` — it sanitizes sensitive data (passwords, tokens)
- Do not generate request IDs manually — use `getCorrelationId(request)` from `@/lib/error-logger` which resolves `x-correlation-id` → `rndr-id` → generated UUIDv4. Both `withApiLogging` and `logApiError` use this shared function for consistent correlation across request/response and error logs
- Return appropriate HTTP status codes: 400 (validation), 401 (unauth), 403 (forbidden), 404, 500
- Never expose raw database errors to clients

## Response Format

- Always use `NextResponse.json()` for responses
- Return the created/updated entity on success
- Return `{ error: string }` on failure
