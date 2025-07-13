/**
 * Duplicate transaction detection logic
 */

import levenshtein from 'fast-levenshtein'
import { calculateDaysDifference } from './duplicate-utils'

export interface Transaction {
  id: string
  transactionDate: string
  description: string
  amount: number
  account: string
  category: string
  type: string
  user: string
  memo?: string
}

export interface DuplicatePair {
  transaction1: Transaction
  transaction2: Transaction
  score: number
  dayScore: number
  descriptionScore: number
  daysDifference: number
}

/**
 * Normalize business description for better comparison
 * Removes common business suffixes, numbers, and normalizes case/spacing
 */
function normalizeDescription(description: string): string {
  return (
    description
      .toLowerCase()
      .trim()
      // Remove common business suffixes
      .replace(/\b(llc|inc|corp|ltd|co|company)\b/g, '')
      // Remove leading numbers and special chars
      .replace(/^[\d\s\-#]+/, '')
      // Normalize spacing
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Calculate Dice coefficient based on character bigrams
 */
function diceCoefficient(str1: string, str2: string): number {
  if (str1 === str2) return 1
  if (str1.length < 2 || str2.length < 2) return 0

  // Generate bigrams (2-character pairs)
  const bigrams1 = new Set<string>()
  const bigrams2 = new Set<string>()

  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2))
  }

  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.add(str2.substring(i, i + 2))
  }

  const intersection = new Set([...bigrams1].filter((x) => bigrams2.has(x)))
  return (2 * intersection.size) / (bigrams1.size + bigrams2.size)
}

/**
 * Calculate normalized Levenshtein distance (0-1, where 1 = identical)
 */
function normalizedLevenshtein(str1: string, str2: string): number {
  if (str1 === str2) return 1

  const maxLength = Math.max(str1.length, str2.length)
  if (maxLength === 0) return 1

  const distance = levenshtein.get(str1, str2)
  return 1 - distance / maxLength
}

/**
 * Calculate word overlap similarity
 */
function wordOverlap(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/).filter((w) => w.length > 2))
  const words2 = new Set(str2.split(/\s+/).filter((w) => w.length > 2))

  if (words1.size === 0 && words2.size === 0) return 1
  if (words1.size === 0 || words2.size === 0) return 0

  const intersection = new Set([...words1].filter((x) => words2.has(x)))
  return (2 * intersection.size) / (words1.size + words2.size)
}

/**
 * Hybrid description similarity using multiple algorithms
 * Combines Dice coefficient, normalized Levenshtein, and word overlap
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  // Normalize descriptions
  const norm1 = normalizeDescription(desc1)
  const norm2 = normalizeDescription(desc2)

  // Calculate individual similarity scores
  const diceScore = diceCoefficient(norm1, norm2)
  const levenshteinScore = normalizedLevenshtein(norm1, norm2)
  const wordScore = wordOverlap(norm1, norm2)

  // Weighted combination (Dice 40%, Levenshtein 30%, Word overlap 30%)
  return diceScore * 0.4 + levenshteinScore * 0.3 + wordScore * 0.3
}

/**
 * Find potential duplicate transactions
 * @param transactions Array of transactions to analyze
 * @param timeWindow Maximum days between transactions to consider (default: 5)
 * @returns Array of duplicate pairs sorted by score (highest first)
 */
export function findDuplicates(
  transactions: Transaction[],
  timeWindow: number = 5
): DuplicatePair[] {
  const duplicatePairs: DuplicatePair[] = []

  // Group transactions by amount for efficiency
  const transactionsByAmount = new Map<number, Transaction[]>()

  for (const transaction of transactions) {
    const amount = Math.abs(transaction.amount) // Use absolute value for comparison
    if (!transactionsByAmount.has(amount)) {
      transactionsByAmount.set(amount, [])
    }
    transactionsByAmount.get(amount)!.push(transaction)
  }

  // Check each group of transactions with the same amount
  for (const [, sameAmountTransactions] of transactionsByAmount) {
    if (sameAmountTransactions.length < 2) continue // Skip if only one transaction

    // Compare each transaction with every other transaction in the group
    for (let i = 0; i < sameAmountTransactions.length; i++) {
      for (let j = i + 1; j < sameAmountTransactions.length; j++) {
        const transaction1 = sameAmountTransactions[i]
        const transaction2 = sameAmountTransactions[j]

        // Calculate days difference
        const daysDifference = calculateDaysDifference(
          transaction1.transactionDate,
          transaction2.transactionDate
        )

        // Skip if outside time window
        if (daysDifference > timeWindow) continue

        // Calculate day proximity score (1 = same day, 0 = timeWindow days apart)
        const dayScore = Math.max(0, 1 - daysDifference / timeWindow)

        // Calculate description similarity using hybrid approach
        const descriptionScore = calculateDescriptionSimilarity(
          transaction1.description,
          transaction2.description
        )

        // Calculate final score (average of day and description scores)
        const finalScore = (dayScore + descriptionScore) / 2

        // Only include pairs with some likelihood of being duplicates
        if (finalScore > 0.1) {
          duplicatePairs.push({
            transaction1,
            transaction2,
            score: finalScore,
            dayScore,
            descriptionScore,
            daysDifference,
          })
        }
      }
    }
  }

  // Sort by score (highest first)
  return duplicatePairs.sort((a, b) => b.score - a.score)
}

/**
 * Get summary statistics for duplicate detection results
 */
export function getDuplicateStats(duplicatePairs: DuplicatePair[]) {
  const total = duplicatePairs.length
  const highRisk = duplicatePairs.filter((pair) => pair.score >= 0.75).length
  const mediumRisk = duplicatePairs.filter((pair) => pair.score >= 0.25 && pair.score < 0.75).length
  const lowRisk = duplicatePairs.filter((pair) => pair.score < 0.25).length

  return {
    total,
    highRisk,
    mediumRisk,
    lowRisk,
  }
}
