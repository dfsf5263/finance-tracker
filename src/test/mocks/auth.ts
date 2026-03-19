import type { AuthContext } from '@/lib/auth-middleware'
import type { HouseholdRole } from '@prisma/client'

// firstName/lastName are string | null per the AuthContext interface
export const mockAuthContext = (overrides?: Partial<AuthContext>): AuthContext => ({
  userId: 'test-user-id',
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  },
  ...overrides,
})

export const mockHouseholdAccess = (role: HouseholdRole = 'OWNER') => ({
  authContext: mockAuthContext(),
  userRole: role,
})
