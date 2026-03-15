import { describe, it, expect } from 'vitest'
import {
  getDuplicateBadgeVariant,
  getDuplicateRiskLabel,
  formatDuplicateScore,
  calculateDaysDifference,
  getDuplicateBadgeColor,
} from '@/lib/duplicate-utils'

describe('getDuplicateBadgeVariant', () => {
  it('returns destructive for score >= 0.75', () => {
    expect(getDuplicateBadgeVariant(0.75)).toBe('destructive')
    expect(getDuplicateBadgeVariant(1.0)).toBe('destructive')
  })

  it('returns default for 0.25 <= score < 0.75', () => {
    expect(getDuplicateBadgeVariant(0.25)).toBe('default')
    expect(getDuplicateBadgeVariant(0.5)).toBe('default')
    expect(getDuplicateBadgeVariant(0.74)).toBe('default')
  })

  it('returns secondary for score < 0.25', () => {
    expect(getDuplicateBadgeVariant(0.0)).toBe('secondary')
    expect(getDuplicateBadgeVariant(0.24)).toBe('secondary')
  })
})

describe('getDuplicateRiskLabel', () => {
  it('returns High Risk for score >= 0.75', () => {
    expect(getDuplicateRiskLabel(0.75)).toBe('High Risk')
    expect(getDuplicateRiskLabel(0.99)).toBe('High Risk')
  })

  it('returns Medium Risk for 0.25 <= score < 0.75', () => {
    expect(getDuplicateRiskLabel(0.25)).toBe('Medium Risk')
    expect(getDuplicateRiskLabel(0.5)).toBe('Medium Risk')
  })

  it('returns Low Risk for score < 0.25', () => {
    expect(getDuplicateRiskLabel(0.1)).toBe('Low Risk')
    expect(getDuplicateRiskLabel(0.0)).toBe('Low Risk')
  })
})

describe('formatDuplicateScore', () => {
  it('formats score as rounded percentage', () => {
    expect(formatDuplicateScore(0.734)).toBe('73%')
    expect(formatDuplicateScore(1.0)).toBe('100%')
    expect(formatDuplicateScore(0.0)).toBe('0%')
    expect(formatDuplicateScore(0.5)).toBe('50%')
  })
})

describe('calculateDaysDifference', () => {
  it('returns 0 for same-day dates', () => {
    expect(calculateDaysDifference('2024-01-15', '2024-01-15')).toBe(0)
  })

  it('returns correct count for dates 3 days apart', () => {
    expect(calculateDaysDifference('2024-01-15', '2024-01-18')).toBe(3)
  })

  it('calculates absolute difference (order independent)', () => {
    expect(calculateDaysDifference('2024-01-18', '2024-01-15')).toBe(3)
  })

  it('returns correct count across month boundaries', () => {
    expect(calculateDaysDifference('2024-01-30', '2024-02-02')).toBe(3)
  })
})

describe('getDuplicateBadgeColor', () => {
  it('returns red class for score >= 0.75', () => {
    const color = getDuplicateBadgeColor(0.8)
    expect(color).toContain('red')
  })

  it('returns orange class for medium risk', () => {
    const color = getDuplicateBadgeColor(0.5)
    expect(color).toContain('orange')
  })

  it('returns green class for low risk', () => {
    const color = getDuplicateBadgeColor(0.1)
    expect(color).toContain('green')
  })
})
