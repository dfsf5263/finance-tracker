'use client'

import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

interface HouseholdOverviewProps {
  household: {
    id: string
    name: string
    annualBudget?: number | null
    createdAt?: string
    userRole?: string
    _count?: {
      accounts: number
      users: number
      categories: number
      types: number
    }
  }
}

export function HouseholdOverview({ household }: HouseholdOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'destructive'
      case 'MEMBER':
        return 'default'
      case 'VIEWER':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-2">Household Name</h3>
          <p className="text-lg font-semibold">{household.name}</p>
        </div>

        {household.userRole && (
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-2">Your Role</h3>
            <Badge variant={getRoleBadgeVariant(household.userRole)}>{household.userRole}</Badge>
          </div>
        )}
      </div>

      {household.annualBudget && (
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-2">Annual Budget</h3>
          <p className="text-lg font-semibold">{formatCurrency(household.annualBudget)}</p>
        </div>
      )}

      {household._count && (
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-2">Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{household._count.users}</p>
              <p className="text-sm text-muted-foreground">Members</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{household._count.accounts}</p>
              <p className="text-sm text-muted-foreground">Accounts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{household._count.categories}</p>
              <p className="text-sm text-muted-foreground">Categories</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{household._count.types}</p>
              <p className="text-sm text-muted-foreground">Types</p>
            </div>
          </div>
        </div>
      )}

      {household.createdAt && (
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-2">Created</h3>
          <p className="text-sm">{format(new Date(household.createdAt), 'PPP')}</p>
        </div>
      )}
    </div>
  )
}
