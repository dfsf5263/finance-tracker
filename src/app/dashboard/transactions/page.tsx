'use client'

import { useState } from 'react'
import { TransactionGrid } from '@/components/transaction-grid'

export default function TransactionsPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefreshTransactions = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <TransactionGrid refreshTrigger={refreshTrigger} onRefresh={handleRefreshTransactions} />
        </div>
      </div>
    </div>
  )
}
