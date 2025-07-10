'use client'

import { UserAllowance } from '@/components/user-allowance'

export default function AllowancePage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <UserAllowance />
        </div>
      </div>
    </div>
  )
}
