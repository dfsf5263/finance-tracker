import { describe, it, expect } from 'vitest'
import {
  canManageData,
  canManageHouseholdSettings,
  canDeleteHousehold,
  canInviteMembers,
  canEditHousehold,
} from '@/lib/role-utils'

describe('canManageData', () => {
  it('returns true for OWNER', () => expect(canManageData('OWNER')).toBe(true))
  it('returns true for MEMBER', () => expect(canManageData('MEMBER')).toBe(true))
  it('returns false for VIEWER', () => expect(canManageData('VIEWER')).toBe(false))
  it('returns false for undefined', () => expect(canManageData(undefined)).toBe(false))
})

describe('canManageHouseholdSettings', () => {
  it('returns true for OWNER', () => expect(canManageHouseholdSettings('OWNER')).toBe(true))
  it('returns false for MEMBER', () => expect(canManageHouseholdSettings('MEMBER')).toBe(false))
  it('returns false for VIEWER', () => expect(canManageHouseholdSettings('VIEWER')).toBe(false))
  it('returns false for undefined', () => expect(canManageHouseholdSettings(undefined)).toBe(false))
})

describe('canDeleteHousehold', () => {
  it('returns true for OWNER', () => expect(canDeleteHousehold('OWNER')).toBe(true))
  it('returns false for MEMBER', () => expect(canDeleteHousehold('MEMBER')).toBe(false))
  it('returns false for VIEWER', () => expect(canDeleteHousehold('VIEWER')).toBe(false))
  it('returns false for undefined', () => expect(canDeleteHousehold(undefined)).toBe(false))
})

describe('canInviteMembers', () => {
  it('returns true for OWNER', () => expect(canInviteMembers('OWNER')).toBe(true))
  it('returns false for MEMBER', () => expect(canInviteMembers('MEMBER')).toBe(false))
  it('returns false for VIEWER', () => expect(canInviteMembers('VIEWER')).toBe(false))
  it('returns false for undefined', () => expect(canInviteMembers(undefined)).toBe(false))
})

describe('canEditHousehold', () => {
  it('returns true for OWNER', () => expect(canEditHousehold('OWNER')).toBe(true))
  it('returns true for MEMBER', () => expect(canEditHousehold('MEMBER')).toBe(true))
  it('returns false for VIEWER', () => expect(canEditHousehold('VIEWER')).toBe(false))
  it('returns false for undefined', () => expect(canEditHousehold(undefined)).toBe(false))
})
