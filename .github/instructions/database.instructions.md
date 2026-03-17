---
description: "Use when writing or modifying Prisma schema, migrations, or database queries. Covers schema conventions, query patterns, and the db singleton."
applyTo: "prisma/**"
---

# Database Standards

## Prisma Setup

- ORM: Prisma 7 with `@prisma/adapter-pg` (PrismaPg adapter)
- Database: PostgreSQL 17
- Schema: `prisma/schema.prisma`
- DB singleton: `import { db } from '@/lib/db'`

## Schema Conventions

- All primary keys are UUIDs: `id String @id @default(uuid())`
- Use `@relation(onDelete: Cascade)` for dependent entities
- Dates stored as `DATE` type (via `@db.Date`) — no time component
- Decimal amounts: `Decimal @db.Decimal(10, 2)`
- Composite uniqueness where applicable: `@@unique([householdId, name])`
- Composite IDs for join tables: `@@id([userId, householdId])`

## Key Models

- **User**: Auth user with firstName, lastName, email
- **Household**: Top-level entity; all financial data is scoped to a household
- **UserHousehold**: Join table with role (OWNER/MEMBER/VIEWER)
- **Transaction**: Core financial record (amount, date, description, category, type, account)
- **HouseholdAccount, HouseholdCategory, HouseholdType**: Classification entities

## Query Patterns

Always scope queries by `householdId` to enforce data isolation:

```ts
const transactions = await db.transaction.findMany({
  where: { householdId },
  orderBy: { transactionDate: 'desc' },
})
```

- Use `select` to limit returned fields when the full model isn't needed
- Use `db.$transaction()` when multiple writes must be atomic

## Migrations

- Generate: `npx prisma migrate dev --name descriptive-name`
- Apply: `npx prisma migrate deploy`
- Migrations live in `prisma/migrations/`
- Never edit existing migration files

## Seeding

- Seed file: `prisma/seed.ts`
- Run: `npx prisma db seed`
