import { HouseholdRole } from '@prisma/client'

/**
 * Check if a user can edit/delete household data
 * OWNER and MEMBER can edit, VIEWER cannot
 */
export function canEditHousehold(role?: string | HouseholdRole): boolean {
  if (!role) return false
  return role === HouseholdRole.OWNER || role === HouseholdRole.MEMBER
}

/**
 * Check if a user can delete a household
 * Only OWNER can delete
 */
export function canDeleteHousehold(role?: string | HouseholdRole): boolean {
  if (!role) return false
  return role === HouseholdRole.OWNER
}

/**
 * Check if a user can manage data (transactions, definitions)
 * OWNER and MEMBER can manage, VIEWER cannot
 */
export function canManageData(role?: string | HouseholdRole): boolean {
  if (!role) return false
  return role === HouseholdRole.OWNER || role === HouseholdRole.MEMBER
}

/**
 * Check if a user can invite members to the household
 * Only OWNER can invite
 */
export function canInviteMembers(role?: string | HouseholdRole): boolean {
  if (!role) return false
  return role === HouseholdRole.OWNER
}

/**
 * Check if a user can manage household settings
 * Only OWNER can manage settings
 */
export function canManageHouseholdSettings(role?: string | HouseholdRole): boolean {
  if (!role) return false
  return role === HouseholdRole.OWNER
}

/**
 * Check if a user can remove members from household
 * Only OWNER can remove members (except themselves)
 */
export function canRemoveMembers(role?: string | HouseholdRole): boolean {
  if (!role) return false
  return role === HouseholdRole.OWNER
}

/**
 * Get a human-readable label for a role
 */
export function getRoleLabel(role?: string | HouseholdRole): string {
  if (!role) return 'Unknown'

  switch (role) {
    case HouseholdRole.OWNER:
      return 'Owner'
    case HouseholdRole.MEMBER:
      return 'Member'
    case HouseholdRole.VIEWER:
      return 'Viewer'
    default:
      return 'Unknown'
  }
}

/**
 * Get a description of role capabilities
 */
export function getRoleDescription(role?: string | HouseholdRole): string {
  if (!role) return 'No permissions'

  switch (role) {
    case HouseholdRole.OWNER:
      return 'Full access to household data and settings'
    case HouseholdRole.MEMBER:
      return 'Can view and edit data, but cannot manage settings'
    case HouseholdRole.VIEWER:
      return 'Can only view data'
    default:
      return 'No permissions'
  }
}
