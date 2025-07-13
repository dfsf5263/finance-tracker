/**
 * Utility functions for duplicate transaction detection
 */

/**
 * Get badge variant/color based on duplicate score
 */
export function getDuplicateBadgeVariant(score: number): 'destructive' | 'default' | 'secondary' {
  if (score >= 0.75) return 'destructive' // Red for high risk
  if (score >= 0.25) return 'default' // Orange for medium risk
  return 'secondary' // Green for low risk
}

/**
 * Get risk label based on duplicate score
 */
export function getDuplicateRiskLabel(score: number): string {
  if (score >= 0.75) return 'High Risk'
  if (score >= 0.25) return 'Medium Risk'
  return 'Low Risk'
}

/**
 * Format duplicate score as percentage
 */
export function formatDuplicateScore(score: number): string {
  return `${Math.round(score * 100)}%`
}

/**
 * Calculate difference in days between two dates
 */
export function calculateDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Get background color class for duplicate score badge
 */
export function getDuplicateBadgeColor(score: number): string {
  if (score >= 0.75) return 'bg-red-100 text-red-800 border-red-200'
  if (score >= 0.25) return 'bg-orange-100 text-orange-800 border-orange-200'
  return 'bg-green-100 text-green-800 border-green-200'
}
