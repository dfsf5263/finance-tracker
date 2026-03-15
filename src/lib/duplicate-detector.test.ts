import { describe, it, expect } from 'vitest'
import { findDuplicates, getDuplicateStats } from '@/lib/duplicate-detector'
import type { Transaction } from '@/lib/duplicate-detector'

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: crypto.randomUUID(),
  transactionDate: '2024-01-15',
  description: 'Coffee Shop',
  amount: 12.5,
  account: 'Chase Checking',
  category: 'Food & Dining',
  type: 'Purchase',
  user: 'Alice',
  ...overrides,
})

describe('findDuplicates', () => {
  it('returns empty array for empty input', () => {
    expect(findDuplicates([])).toEqual([])
  })

  it('returns empty array for a single transaction', () => {
    expect(findDuplicates([makeTransaction()])).toEqual([])
  })

  it('detects identical transactions as duplicates', () => {
    const t1 = makeTransaction({ id: 'id-1' })
    const t2 = makeTransaction({ id: 'id-2' })
    const result = findDuplicates([t1, t2])
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].score).toBeGreaterThan(0.9)
  })

  it('detects similar transactions within the default 5-day time window', () => {
    const t1 = makeTransaction({
      id: 'id-1',
      transactionDate: '2024-01-15',
      description: 'Starbucks Coffee',
    })
    const t2 = makeTransaction({
      id: 'id-2',
      transactionDate: '2024-01-18',
      description: 'Starbucks Coffee',
    })
    const result = findDuplicates([t1, t2])
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes pairs outside the 5-day time window', () => {
    const t1 = makeTransaction({
      id: 'id-1',
      transactionDate: '2024-01-01',
      description: 'Starbucks Coffee',
    })
    const t2 = makeTransaction({
      id: 'id-2',
      transactionDate: '2024-01-08',
      description: 'Starbucks Coffee',
    })
    const result = findDuplicates([t1, t2])
    // 7 days apart, outside default window of 5
    expect(result.length).toBe(0)
  })

  it('never pairs transactions with different amounts', () => {
    const t1 = makeTransaction({ id: 'id-1', amount: 12.5, description: 'Coffee' })
    const t2 = makeTransaction({ id: 'id-2', amount: 15.0, description: 'Coffee' })
    const result = findDuplicates([t1, t2])
    expect(result.length).toBe(0)
  })

  it('returns results sorted by score descending', () => {
    const t1 = makeTransaction({ id: 'id-1', description: 'Starbucks Coffee' })
    const t2 = makeTransaction({ id: 'id-2', description: 'Starbucks Coffee' })
    const t3 = makeTransaction({ id: 'id-3', description: 'Different Store' })
    const t4 = makeTransaction({ id: 'id-4', description: 'Different Store' })
    const result = findDuplicates([t1, t2, t3, t4])
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
  })

  it('returns only pairs with score > 0.1', () => {
    const t1 = makeTransaction({ id: 'id-1', description: 'AAAA' })
    const t2 = makeTransaction({ id: 'id-2', description: 'ZZZZ' })
    const result = findDuplicates([t1, t2])
    result.forEach((pair) => expect(pair.score).toBeGreaterThan(0.1))
  })

  it('includes all required fields on each duplicate pair', () => {
    const t1 = makeTransaction({ id: 'id-1' })
    const t2 = makeTransaction({ id: 'id-2' })
    const result = findDuplicates([t1, t2])
    expect(result.length).toBeGreaterThan(0)
    const pair = result[0]
    expect(pair).toHaveProperty('transaction1')
    expect(pair).toHaveProperty('transaction2')
    expect(pair).toHaveProperty('score')
    expect(pair).toHaveProperty('dayScore')
    expect(pair).toHaveProperty('descriptionScore')
    expect(pair).toHaveProperty('daysDifference')
  })
})

describe('getDuplicateStats', () => {
  it('returns all zeros for empty input', () => {
    const stats = getDuplicateStats([])
    expect(stats.total).toBe(0)
    expect(stats.highRisk).toBe(0)
    expect(stats.mediumRisk).toBe(0)
    expect(stats.lowRisk).toBe(0)
  })

  it('classifies high risk pairs (score >= 0.75)', () => {
    const highRiskPair = {
      transaction1: makeTransaction({ id: 'a' }),
      transaction2: makeTransaction({ id: 'b' }),
      score: 0.9,
      dayScore: 0.9,
      descriptionScore: 0.9,
      daysDifference: 0,
    }
    const stats = getDuplicateStats([highRiskPair])
    expect(stats.total).toBe(1)
    expect(stats.highRisk).toBe(1)
    expect(stats.mediumRisk).toBe(0)
    expect(stats.lowRisk).toBe(0)
  })

  it('classifies medium risk pairs (0.25 <= score < 0.75)', () => {
    const mediumPair = {
      transaction1: makeTransaction({ id: 'a' }),
      transaction2: makeTransaction({ id: 'b' }),
      score: 0.5,
      dayScore: 0.5,
      descriptionScore: 0.5,
      daysDifference: 2,
    }
    const stats = getDuplicateStats([mediumPair])
    expect(stats.mediumRisk).toBe(1)
    expect(stats.highRisk).toBe(0)
    expect(stats.lowRisk).toBe(0)
  })

  it('classifies low risk pairs (score < 0.25)', () => {
    const lowPair = {
      transaction1: makeTransaction({ id: 'a' }),
      transaction2: makeTransaction({ id: 'b' }),
      score: 0.15,
      dayScore: 0.15,
      descriptionScore: 0.15,
      daysDifference: 4,
    }
    const stats = getDuplicateStats([lowPair])
    expect(stats.lowRisk).toBe(1)
  })
})
