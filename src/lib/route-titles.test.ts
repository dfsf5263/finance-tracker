import { describe, it, expect } from 'vitest'
import { getPageTitle } from './route-titles'

describe('getPageTitle', () => {
  it('returns Dashboard for /dashboard', () => {
    expect(getPageTitle('/dashboard')).toBe('Dashboard')
  })

  it('returns correct title for CSV Converter', () => {
    expect(getPageTitle('/dashboard/utility/csv-converter')).toBe('Utility - CSV Converter')
  })

  it('returns correct title for DeDupe', () => {
    expect(getPageTitle('/dashboard/utility/dedupe')).toBe('Utility - DeDupe')
  })

  it('returns correct title for known routes', () => {
    expect(getPageTitle('/dashboard/transactions/manage')).toBe('Manage Transactions')
    expect(getPageTitle('/dashboard/analytics/breakdown')).toBe('Analytics - Breakdown')
    expect(getPageTitle('/dashboard/settings')).toBe('Settings')
  })

  it('returns Household Settings for dynamic household route', () => {
    expect(getPageTitle('/dashboard/households/abc-123/settings')).toBe('Household Settings')
  })

  it('falls back to Dashboard for unknown routes', () => {
    expect(getPageTitle('/dashboard/unknown-page')).toBe('Dashboard')
  })
})
