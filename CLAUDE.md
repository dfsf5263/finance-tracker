# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production
- `npm run format` - Format code with Biome
- `npm run check` - Run lint and typecheck (run this before committing)

**IMPORTANT**: After making any code changes, always run:
1. `npm run format` - Format the code
2. `npm run check` - Verify no linting or type errors

## Architecture Overview

This is a Next.js 15 personal website using the App Router with TypeScript and Tailwind CSS v4. The site integrates with a Postgres backend for data persistence via Prisma 6.

### Key Directories

- `src/app/` - Next.js App Router pages and layouts
- `src/components/` - Reusable UI components
- `src/lib/` - Types and utilities
- `prisma/` - Prisma configuration

### Styling

Uses Tailwind CSS v4 with PostCSS processing. Dark mode support is implemented via CSS custom properties in the root layout.