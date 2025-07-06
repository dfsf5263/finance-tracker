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

## Project Overview

This is a **Personal Finance Tracker** application built with Next.js 15 using the App Router, TypeScript, and a comprehensive shadcn/ui dashboard interface. The application enables users to track financial transactions, visualize spending patterns, and manage financial data through an intuitive dashboard interface.

**Key Features:**
- Dashboard overview with financial metrics and quick actions
- Transaction management with advanced filtering and CSV import
- Split analytics with dedicated breakdown and money flow visualizations
- Administrative interface for managing categories, sources, users, and transaction types
- Responsive sidebar navigation with collapsible functionality
- Dark/light mode support