'use client'

import { useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { TransactionForm } from '@/components/transaction-form'
import { useHousehold } from '@/contexts/household-context'
import { Home, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http-utils'
import { invalidateActiveMonthCache } from '@/hooks/use-active-month'
import { canManageData } from '@/lib/role-utils'

interface Transaction {
  id: string
  accountId: string
  userId: string | null
  transactionDate: string
  postDate: string
  description: string
  categoryId: string
  typeId: string
  amount: number
  memo?: string
  householdId: string
  createdAt: string
  updatedAt: string
}

export function SiteHeader({ title }: { title: string }) {
  const { state } = useSidebar()
  const { selectedHousehold, isLoading, getUserRole } = useHousehold()
  const userRole = getUserRole()
  const canEdit = canManageData(userRole)
  const isCollapsed = state === 'collapsed'
  const [showTransactionForm, setShowTransactionForm] = useState(false)

  const renderHouseholdInfo = () => {
    if (!isCollapsed) return null

    if (isLoading) {
      return (
        <>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1">
            <Home className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </>
      )
    }

    if (!selectedHousehold) {
      return (
        <>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1">
            <Home className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No Household</span>
          </div>
        </>
      )
    }

    return (
      <>
        <span className="text-muted-foreground">•</span>
        <div className="flex items-center gap-1">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{selectedHousehold.name}</span>
        </div>
      </>
    )
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="text-base font-medium">{title}</h1>
        {renderHouseholdInfo()}
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="icon" onClick={() => setShowTransactionForm(true)}>
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add transaction</span>
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>

      <TransactionForm
        open={showTransactionForm}
        onClose={() => setShowTransactionForm(false)}
        onSubmit={handleTransactionSubmit}
      />
    </header>
  )

  async function handleTransactionSubmit(
    transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { amount: number }
  ) {
    const { data, error } = await apiFetch<Transaction>('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
      showErrorToast: false, // Handle success/error toasts manually
      showRateLimitToast: true, // Show rate limit toasts
    })

    if (data) {
      // Success case
      setShowTransactionForm(false)

      // Invalidate active month cache to refresh dashboard components
      if (selectedHousehold?.id) {
        invalidateActiveMonthCache(selectedHousehold.id)
      }

      // Show success toast
      toast.success('Transaction created successfully')
    } else if (error) {
      console.error('Error saving transaction:', error)
      // Only show toast if it's not a rate limit error (already handled by apiFetch)
      if (!error.includes('Rate limit exceeded')) {
        toast.error(error || 'Failed to save transaction')
      }
    }
  }
}
