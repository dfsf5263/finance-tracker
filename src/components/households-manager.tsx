'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Edit,
  Trash2,
  Plus,
  Home,
  Users,
  CreditCard,
  Settings,
  DollarSign,
  UserRoundPlus,
  LogOut,
} from 'lucide-react'
import { HouseholdForm } from './household-form'
import { useCRUD } from '@/hooks/useCRUD'
import { useHousehold } from '@/contexts/household-context'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  canDeleteHousehold,
  canManageHouseholdSettings,
  canInviteMembers,
  canLeaveHousehold,
  getRoleLabel,
} from '@/lib/role-utils'
import { apiFetch } from '@/lib/http-utils'
import { toast } from 'sonner'
import { LeaveHouseholdDialog } from './leave-household-dialog'
import { DeleteHouseholdDialog } from './delete-household-dialog'
import { useDbUser } from '@/hooks/useDbUser'

interface Household {
  id: string
  name: string
  annualBudget?: number | null
  _count?: {
    accounts: number
    users: number
    categories: number
    types: number
    transactions: number
  }
}

export function HouseholdsManager() {
  const router = useRouter()
  const { dbUser } = useDbUser()
  const {
    refreshHouseholds,
    households: contextHouseholds,
    isLoading: contextLoading,
    getUserRole,
    selectHousehold,
  } = useHousehold()
  const {
    items: households,
    formOpen,
    editingItem: editingHousehold,
    setFormOpen,
    // handleCreate: Not used - we implement custom logic to bypass permission checks
    // handleEdit: Not used - we need custom logic for households
    closeForm,
    fetchItems,
  } = useCRUD<Household>('households', 'Household')

  // Local state for editing, leaving, and deleting
  const [localEditingHousehold, setLocalEditingHousehold] = useState<Household | undefined>()
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [householdToLeave, setHouseholdToLeave] = useState<Household | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [householdToDelete, setHouseholdToDelete] = useState<Household | null>(null)

  // Track previous household count to detect creation scenarios
  const previousCountRef = useRef<number>(contextHouseholds.length)

  // Monitor household context changes and refresh page data when needed
  useEffect(() => {
    const currentCount = contextHouseholds.length
    const previousCount = previousCountRef.current

    // If households were created (count increased) and context is not loading, refresh page data
    if (currentCount > previousCount && !contextLoading) {
      fetchItems()
    }

    // Update the ref for next comparison
    previousCountRef.current = currentCount
  }, [contextHouseholds.length, contextLoading, fetchItems])

  // Custom handleEdit that bypasses useCRUD's permission check
  const handleEdit = (household: Household) => {
    setLocalEditingHousehold(household)
    setFormOpen(true)
  }

  // Handle both create and update operations
  const handleCreateOrUpdate = async (householdData: Omit<Household, 'id'>) => {
    if (localEditingHousehold) {
      // Update existing household
      const { error } = await apiFetch(`/api/households/${localEditingHousehold.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(householdData),
        showErrorToast: false,
        showRateLimitToast: true,
      })

      if (!error) {
        fetchItems()
        toast.success('Household updated successfully')
        // Refresh the household context to update sidebar and header
        await refreshHouseholds()
        closeForm()
        setLocalEditingHousehold(undefined)
      } else {
        console.error('Failed to update household:', error)
        if (!error.includes('Rate limit exceeded')) {
          toast.error('Failed to update household')
        }
      }
    } else {
      // Create new household - direct API call to bypass useCRUD permission check
      const { error } = await apiFetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(householdData),
        showErrorToast: false,
        showRateLimitToast: true,
      })

      if (!error) {
        fetchItems()
        toast.success('Household created successfully')
        // Refresh the household context to update sidebar and header
        await refreshHouseholds()
        closeForm()
      } else {
        console.error('Failed to create household:', error)
        if (!error.includes('Rate limit exceeded')) {
          toast.error('Failed to create household')
        }
      }
    }
  }

  // Handle delete button click - open confirmation dialog
  const handleDeleteClick = (household: Household) => {
    setHouseholdToDelete(household)
    setDeleteDialogOpen(true)
  }

  // Handle successful delete
  const handleDeleteSuccess = async () => {
    fetchItems()
    await refreshHouseholds()
    setHouseholdToDelete(null)
  }

  // Handle share/invite navigation
  const handleShare = (household: Household) => {
    // Set the household in context
    selectHousehold(household)
    // Navigate to the new settings page with invitations tab
    router.push(`/dashboard/settings/household?tab=invitations`)
  }

  // Handle leave household
  const handleLeave = (household: Household) => {
    setHouseholdToLeave(household)
    setLeaveDialogOpen(true)
  }

  // Handle successful leave
  const handleLeaveSuccess = async () => {
    fetchItems()
    // Refresh the household context to update sidebar and header
    await refreshHouseholds()
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'Not set'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Households
            </div>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Household
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {households.map((household) => (
              <Card key={household.id} className="border border-border overflow-hidden">
                <CardContent className="p-4 overflow-hidden">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {getRoleLabel(getUserRole(household.id))}
                        </Badge>
                        <h3 className="font-semibold text-lg truncate">{household.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Budget: {formatCurrency(household.annualBudget)}
                      </p>
                    </div>

                    {household._count && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {household._count.accounts} Accounts
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {household._count.users} Users
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            <Settings className="h-3 w-3 mr-1" />
                            {household._count.categories} Categories
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {household._count.types} Types
                          </Badge>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-1 pt-1">
                      {canManageHouseholdSettings(getUserRole(household.id)) && (
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(household)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canInviteMembers(getUserRole(household.id)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShare(household)}
                          title="Share household"
                        >
                          <UserRoundPlus className="h-4 w-4" />
                        </Button>
                      )}
                      {canLeaveHousehold(getUserRole(household.id)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLeave(household)}
                          title="Leave household"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteHousehold(getUserRole(household.id)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(household)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {households.length === 0 && (
              <div className="col-span-full">
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No households found</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first household to start managing your finances.
                    </p>
                    <Button onClick={() => setFormOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Household
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <HouseholdForm
        household={localEditingHousehold || editingHousehold}
        open={formOpen}
        onClose={() => {
          closeForm()
          setLocalEditingHousehold(undefined)
        }}
        onSubmit={handleCreateOrUpdate}
      />

      {householdToLeave && dbUser && (
        <LeaveHouseholdDialog
          open={leaveDialogOpen}
          onOpenChange={setLeaveDialogOpen}
          householdId={householdToLeave.id}
          householdName={householdToLeave.name}
          userId={dbUser.id}
          onSuccess={handleLeaveSuccess}
        />
      )}

      {/* Delete Household Dialog */}
      {householdToDelete && (
        <DeleteHouseholdDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          householdId={householdToDelete.id}
          householdName={householdToDelete.name}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  )
}
