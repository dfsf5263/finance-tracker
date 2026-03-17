import { describe, it, expect } from 'vitest'
import {
  canManageData,
  canManageHouseholdSettings,
  canDeleteHousehold,
  canInviteMembers,
  canEditHousehold,
  canViewInvitations,
  canLeaveHousehold,
  canRemoveMembers,
  getRoleLabel,
  getRoleDescription,
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

describe('canViewInvitations', () => {
  it('returns true for OWNER', () => expect(canViewInvitations('OWNER')).toBe(true))
  it('returns false for MEMBER', () => expect(canViewInvitations('MEMBER')).toBe(false))
  it('returns false for VIEWER', () => expect(canViewInvitations('VIEWER')).toBe(false))
  it('returns false for undefined', () => expect(canViewInvitations(undefined)).toBe(false))
})

describe('canLeaveHousehold', () => {
  it('returns false for OWNER', () => expect(canLeaveHousehold('OWNER')).toBe(false))
  it('returns true for MEMBER', () => expect(canLeaveHousehold('MEMBER')).toBe(true))
  it('returns true for VIEWER', () => expect(canLeaveHousehold('VIEWER')).toBe(true))
  it('returns false for undefined', () => expect(canLeaveHousehold(undefined)).toBe(false))
})

describe('canRemoveMembers', () => {
  it('returns true for OWNER', () => expect(canRemoveMembers('OWNER')).toBe(true))
  it('returns false for MEMBER', () => expect(canRemoveMembers('MEMBER')).toBe(false))
  it('returns false for VIEWER', () => expect(canRemoveMembers('VIEWER')).toBe(false))
  it('returns false for undefined', () => expect(canRemoveMembers(undefined)).toBe(false))
})

describe('getRoleLabel', () => {
  it('returns Owner for OWNER', () => expect(getRoleLabel('OWNER')).toBe('Owner'))
  it('returns Member for MEMBER', () => expect(getRoleLabel('MEMBER')).toBe('Member'))
  it('returns Viewer for VIEWER', () => expect(getRoleLabel('VIEWER')).toBe('Viewer'))
  it('returns Unknown for undefined', () => expect(getRoleLabel(undefined)).toBe('Unknown'))
  it('returns Unknown for invalid role', () => expect(getRoleLabel('INVALID')).toBe('Unknown'))
})

describe('getRoleDescription', () => {
  it('returns full access for OWNER', () => {
    expect(getRoleDescription('OWNER')).toContain('Full access')
  })
  it('returns edit description for MEMBER', () => {
    expect(getRoleDescription('MEMBER')).toContain('view and edit')
  })
  it('returns view-only for VIEWER', () => {
    expect(getRoleDescription('VIEWER')).toContain('only view')
  })
  it('returns no permissions for undefined', () => {
    expect(getRoleDescription(undefined)).toBe('No permissions')
  })
  it('returns no permissions for invalid role', () => {
    expect(getRoleDescription('INVALID')).toBe('No permissions')
  })
})
