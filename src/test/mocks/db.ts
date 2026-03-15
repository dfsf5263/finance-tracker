import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import { beforeEach } from 'vitest'

export const mockDb = mockDeep<PrismaClient>()

// Reset all mock return values between tests
beforeEach(() => {
  mockReset(mockDb)
  // Default $transaction implementation: pass-through callback with mockDb as the tx argument.
  // Override per-test when you need to assert on transaction internals.
  mockDb.$transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb)
  )
})
