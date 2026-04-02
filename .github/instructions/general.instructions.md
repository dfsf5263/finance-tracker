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
- **Next.js middleware**: `src/proxy.ts` — Next.js 16 renamed the middleware entry point from `middleware.ts` to `proxy.ts`. Do not look for or create `middleware.ts`; all edge middleware logic lives in `src/proxy.ts`.
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

## Pre-Commit Checks (Copilot)

Before staging any changes to git, always run the following three commands in order and verify each one succeeds before proceeding:

1. `npm run format` — auto-formats all source files
2. `npm run check` — runs lint, format check, and TypeScript typecheck
3. `npm run test` — runs the full Vitest unit test suite

Do not stage or commit if any of these commands fail. Fix all errors first, then re-run the checks.

## Commit Messages (Copilot)

Use Conventional Commits for all new commits.

- Preferred format: `<type>(<scope>): <summary>`
- Scope is recommended when it adds clarity and may be omitted when the change is repo-wide
- Keep the summary concise, imperative, and without a trailing period
- Choose the type that best matches the primary intent of the change

Allowed types:

- `feat`: a user-facing feature or capability
- `fix`: a bug fix or regression fix
- `refactor`: code restructuring without behavior changes
- `perf`: a performance improvement
- `test`: adding or updating tests
- `docs`: documentation-only changes
- `build`: changes to dependencies, packaging, or build tooling
- `ci`: changes to GitHub Actions or other CI/CD automation
- `chore`: maintenance work that does not fit the types above
- `revert`: reverting a previous commit

Examples:

- `feat(auth): add household invitation acceptance flow`
- `fix(zap): encode context user credentials correctly`
- `ci(actions): add authenticated ZAP full scan`
