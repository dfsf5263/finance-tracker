export interface DefaultCategory {
  name: string
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Essential Living
  { name: 'Food & Drink' },
  { name: 'Transportation' },
  { name: 'Bills & Utilities' },
  { name: 'Healthcare' },
  { name: 'Gas' },
  { name: 'Groceries' },
  { name: 'Automotive' },

  // Lifestyle & Entertainment
  { name: 'Entertainment' },
  { name: 'Shopping' },
  { name: 'Personal' },
  { name: 'Travel' },

  // Home & Family
  { name: 'Home' },
  { name: 'Family & Kids' },
  { name: 'Education' },
  { name: 'Gifts & Donations' },
  { name: 'Health & Wellness' },

  // Miscellaneous
  { name: 'Pets' },
  { name: 'Taxes' },
  { name: 'Other' },
  { name: 'Professional Services' },
]
