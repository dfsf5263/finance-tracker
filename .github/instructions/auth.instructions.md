---
description: "Use when working on authentication, authorization, sessions, TOTP 2FA, password reset, or household invitation flows."
---

# Authentication & Authorization Standards

## Auth Framework

- **Library**: better-auth (configured in `src/lib/auth.ts`)
- **Client**: `src/lib/auth-client.ts` (client-side auth helpers)
- **Helpers**: `src/lib/auth-helpers.ts` (server-side session utilities)
- **Middleware**: `src/lib/auth-middleware.ts` (route protection)

## Session Management

- Sessions stored in the database via Prisma
- 7-day session expiry, 1-day update window
- HTTP-only cookies for session persistence
- Auth routes: `/api/auth/[...all]` (handled by better-auth)

## Route Protection

### API Routes

```ts
import { requireAuth, requireHouseholdAccess, requireHouseholdWriteAccess } from '@/lib/auth-middleware'

// Just check authenticated
const authResult = await requireAuth()
if (authResult instanceof NextResponse) return authResult
// authResult: { userId, user }

// Check household membership + get role
const result = await requireHouseholdAccess(request, householdId)
if (result instanceof NextResponse) return result
// result: { userId, user, role }

// Check write access (OWNER or MEMBER)
const result = await requireHouseholdWriteAccess(request, householdId)
```

### Client-Side

Use `AuthGuard` component or `useSession()` from `@/lib/auth-client`.

## RBAC

Roles: `OWNER` | `MEMBER` | `VIEWER`

Permission helpers from `@/lib/role-utils`:
- `canManageData(role)` — OWNER, MEMBER
- `canInviteMembers(role)` — OWNER
- `canEditHousehold(role)` — OWNER
- `canDeleteHousehold(role)` — OWNER

## Features

- Email verification (optional, based on `RESEND_API_KEY`)
- Password reset via email (1-hour token expiry)
- TOTP 2FA with backup codes
- Household invitations with expiring tokens
