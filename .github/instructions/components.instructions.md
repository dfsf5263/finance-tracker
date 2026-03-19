---
description: "Use when creating or modifying React components, pages, or layouts. Covers component patterns, shadcn/ui usage, styling, and state management."
applyTo: "src/components/**"
---

# Component Standards

## Client vs Server Components

- Default to Server Components (no directive needed)
- Add `"use client"` only when the component uses hooks, event handlers, or browser APIs
- Keep `"use client"` components as leaf nodes where possible

## Component Structure

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface MyComponentProps {
  items: Item[]
  onSave: (data: FormData) => void
  className?: string
}

export function MyComponent({ items, onSave, className }: MyComponentProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('space-y-4', className)}>
      {/* component content */}
    </div>
  )
}
```

## Props

- Define props with a TypeScript `interface`, not inline
- Use descriptive names: `onSave`, `isLoading`, `selectedItem`
- Prefer callback props (`onSubmit`, `onDelete`) over exposing internal state

## UI Components

Use shadcn/ui components from `@/components/ui/`:

Available: accordion, alert, avatar, badge, button, calendar, card, checkbox, date-picker, dialog, dropdown-menu, input-otp, input, label, loading-overlay, popover, select, separator, sheet, sidebar, skeleton, sonner, switch, table, tabs, tooltip

## Styling

- Use Tailwind CSS utility classes
- Use `cn()` from `@/lib/utils` to merge conditional classNames:

```tsx
<div className={cn('rounded-lg border p-4', isActive && 'border-primary')}>
```

- Never use inline `style` attributes
- Icons from `lucide-react`

## State & Data

- Use `useCRUD` hook for standard CRUD operations
- Use `useActiveMonth` for month-based filtering
- Access household context via `useHousehold()` from `@/contexts/household-context`
- Toast notifications via `sonner` — use `toast.success()`, `toast.error()`

## Forms & Data Flow

- Parent components own API calls (fetch + mutate) and pass data/callbacks as props
- Forms receive `onSubmit` callback props — parent owns submission logic
- Wrap forms in `<Dialog>` from `@/components/ui/dialog`
- Use `<LoadingOverlay>` from `@/components/ui/loading-overlay` for loading states
- Use `<Button variant="ghost" size="icon">` with lucide-react icons for action buttons in cards

## Client-Side API Calls

Use `apiFetch` from `@/lib/http-utils`:

```ts
const { data, error } = await apiFetch<Transaction[]>('/api/transactions?householdId=...')
```

Handles rate limiting (429), error toasts, and network errors automatically.

## Currency & Dates

- Format currency: `formatCurrency()` from `@/lib/utils`
- Date handling: Use `date-fns` helpers and utilities from `@/lib/utils`
- Dates are stored as DATE type (no time component) in the database

## Accessibility

- Use semantic HTML elements (`<label>`, `<button>`, `<nav>`, `<main>`, `<section>`) over generic `<div>` or `<span>` when the element has inherent meaning or behavior
- Clickable areas that trigger actions must be `<button>` or `<a>` — never a `<div>` with only `onClick`
- File upload zones should use `<label htmlFor="...">` wrapping or associated with the `<input type="file">` so they are keyboard and screen-reader accessible
- All interactive elements must be keyboard-reachable (focusable and operable via Enter/Space)
- Use `aria-label` or `aria-labelledby` on icon-only buttons and controls that lack visible text
- Prefer shadcn/ui primitives (which include ARIA roles) over custom implementations
