# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production
- `npm run format` - Format code with Biome
- `npm run check` - Run lint and typecheck (run this before committing)

**IMPORTANT**: After making any code changes, always run:
1. `npm run format` - Format the code
2. `npm run check` - Verify no linting or type errors. Attempt to fix warnings as well.

## Project Overview

This is a **Personal Finance Tracker** application built with Next.js 15 using the App Router, TypeScript, and a comprehensive shadcn/ui dashboard interface. The application enables users to track financial transactions, visualize spending patterns, and manage financial data through an intuitive dashboard interface.

## Project Structure and Guidelines

### Technology Stack

**Frontend:**
- **Next.js 15** with App Router architecture for modern React patterns
- **TypeScript** for comprehensive type safety and developer experience
- **Tailwind CSS v4** for utility-first styling with Tailwind Animate
- **shadcn/ui** component library built on Radix UI primitives
- **React 19** with modern hooks and concurrent features

**Backend & Database:**
- **PostgreSQL 17** database with native UUID support
- **Prisma ORM** for type-safe database operations and migrations
- **Next.js API Routes** for RESTful backend services
- **Better Auth** for email/password authentication with server-side sessions reference **docs/BETTER-AUTH.md** for documentation

**Development Tools:**
- **Biome** for fast formatting and linting (replaces ESLint + Prettier)
- **TypeScript** compiler for type checking
- **Turbopack** for fast development builds

### Project Structure

```
src/
├── app/                          # Next.js App Router pages and API routes
│   ├── api/                     # Backend API endpoints
│   ├── dashboard/              # Main application pages
├── components/                 # Reusable React components
├── hooks/                     # Custom React hooks
├── lib/                      # Utility functions and configurations
prisma/
├── schema.prisma            # Database schema definition
└── seed.ts                 # Database seeding script
```

### Coding Guidelines

**Key Design Principals**
- **Always use the shadcn/ui Component**: If there is a shadcn/ui component available for the task, use it instead of basic html or react

### Database Schema Guidelines

**Key Design Principles:**
- **UUID Primary Keys**: All models use PostgreSQL native UUIDs via `@default(uuid()) @db.Uuid`
- **Normalized Structure**: Separate entities for accounts, users, categories, and types
- **Audit Trails**: All models include `createdAt` and `updatedAt` timestamps
- **Referential Integrity**: Proper foreign key relationships with cascading rules
- **Singular Naming**: All models are named in the singular context

**Core Models:**
- `TransactionAccount`: Financial institutions/accounts (Chase Bank, Wells Fargo, etc.)
- `TransactionUser`: People who make transactions
- `TransactionCategory`: Expense/income categories (Food & Dining, Transportation, etc.)
- `TransactionType`: Transaction types with inflow/outflow flags
- `Transaction`: Central transaction records linking all entities