export interface DefaultType {
  name: string
  isOutflow: boolean
}

export const DEFAULT_TYPES: DefaultType[] = [
  // Income Types (isOutflow = false)
  { name: 'Income', isOutflow: false },
  { name: 'Bonus', isOutflow: false },
  { name: 'Refund', isOutflow: false },
  { name: 'Side Income', isOutflow: false },

  // Expense Types (isOutflow = true)
  { name: 'Expense', isOutflow: true },
  { name: 'Bill Payment', isOutflow: true },
  { name: 'Purchase', isOutflow: true },
  { name: 'Donation', isOutflow: true },
]
