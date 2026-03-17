---
applyTo: "**"
---

# Finance Tracker — Project Standards

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19 and Turbopack
- **Language**: TypeScript 5 (strict mode)
- **Database**: PostgreSQL 17 with Prisma 7 ORM (PrismaPg adapter)
- **Auth**: better-auth with TOTP 2FA support
- **UI**: shadcn/ui (new-york style, RSC enabled) + Tailwind CSS 4
- **Validation**: Zod 4
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Logging**: pino
- **Email**: Resend

## Code Style (enforced by Biome)

- 2-space indentation, 100-char line width
- Single quotes in JS/TS, double quotes in JSX
- No semicolons
- ES5 trailing commas (multi-line only)
- Always use parentheses around arrow function parameters
- LF line endings

## Path Aliases

Use `@/*` which maps to `./src/*`:

```ts
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
```

## File Naming

- Components: `kebab-case.tsx` (e.g., `account-form.tsx`, `budget-alerts.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useCRUD.ts`, `useActiveMonth.ts`) or `kebab-case.ts` with `use-` prefix (e.g., `use-active-month.ts`)
- API routes: `route.ts` inside App Router directory structure
- Tests: `*.test.ts` or `*.test.tsx` co-located with source
- E2E tests: `*.spec.ts` in `tests/e2e/`

## Symbol Naming

- Components & interfaces: PascalCase
- Functions & variables: camelCase
- Hooks: `use` prefix + camelCase
- Enums: PascalCase values (e.g., `OWNER`, `MEMBER`, `VIEWER`)

## RBAC Roles

Three roles exist: **OWNER**, **MEMBER**, **VIEWER**.
- OWNER: Full access (edit, invite, settings, delete household)
- MEMBER: Edit data, cannot invite or delete household
- VIEWER: Read-only

Use `canManageData()`, `canInviteMembers()`, etc. from `@/lib/role-utils` for permission checks.

## Environment Variables

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`
Optional: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LOG_LEVEL`
