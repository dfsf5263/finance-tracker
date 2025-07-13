export interface DefaultCategory {
  name: string
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Essential Living
  { name: 'Food & Dining' },
  { name: 'Transportation' },
  { name: 'Bills & Utilities' },
  { name: 'Healthcare' },
  { name: 'Gas' },
  { name: 'Groceries' },

  // Lifestyle & Entertainment
  { name: 'Entertainment' },
  { name: 'Shopping' },
  { name: 'Personal Care' },
  { name: 'Travel' },

  // Home & Family
  { name: 'Home & Garden' },
  { name: 'Family & Kids' },
  { name: 'Education' },
  { name: 'Gifts & Donations' },
  { name: 'Health & Wellness' },

  // Miscellaneous
  { name: 'Pets' },
  { name: 'Taxes' },
  { name: 'Other' },
]
