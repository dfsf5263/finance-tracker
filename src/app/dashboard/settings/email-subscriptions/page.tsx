'use client'

import { EmailSubscriptionsList } from '@/components/email-subscriptions-list'

export default function EmailSubscriptionsPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="space-y-6">
            <EmailSubscriptionsList />
          </div>
        </div>
      </div>
    </div>
  )
}
