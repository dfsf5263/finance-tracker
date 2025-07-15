'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HouseholdMembersList } from '@/components/household-members-list'
import { HouseholdInvitationsList } from '@/components/household-invitations-list'
import { HouseholdOverview } from '@/components/household-overview'
import { useHousehold } from '@/contexts/household-context'
import { Button } from '@/components/ui/button'
import { Home, LogOut, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { canLeaveHousehold, canDeleteHousehold } from '@/lib/role-utils'
import { LeaveHouseholdDialog } from '@/components/leave-household-dialog'
import { DeleteHouseholdDialog } from '@/components/delete-household-dialog'
import { useRouter } from 'next/navigation'
import { useDbUser } from '@/hooks/useDbUser'

function HouseholdSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { dbUser } = useDbUser()
  const { selectedHousehold, getUserRole, refreshHouseholds } = useHousehold()
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Get initial tab from URL parameter or default to overview
  const initialTab = searchParams.get('tab') || 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)

  // Update tab when URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['overview', 'members', 'invitations'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Handle successful leave
  const handleLeaveSuccess = async () => {
    await refreshHouseholds()
    router.push('/dashboard/definitions/households')
  }

  // Handle successful delete
  const handleDeleteSuccess = async () => {
    await refreshHouseholds()
    router.push('/dashboard/definitions/households')
  }

  const userRole = selectedHousehold ? getUserRole(selectedHousehold.id) : undefined
  const canLeave = canLeaveHousehold(userRole)
  const canDelete = canDeleteHousehold(userRole)

  if (!selectedHousehold) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <Card className="p-6">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-semibold">No Household Selected</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Please select a household from the household selector in the sidebar or manage
                    your households.
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/definitions/households">Manage Households</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground">
                  Manage {selectedHousehold.name} settings, members, and invitations
                </p>
              </div>
              <div>
                {canLeave && (
                  <Button variant="default" onClick={() => setLeaveDialogOpen(true)}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Leave
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="invitations">Invitations</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader className="py-6">
                    <CardTitle>Household Overview</CardTitle>
                    <CardDescription>Basic information about your household</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <HouseholdOverview household={selectedHousehold} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="members" className="space-y-4">
                <Card>
                  <CardHeader className="py-6">
                    <CardTitle>Household Members</CardTitle>
                    <CardDescription>Manage who has access to this household</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <HouseholdMembersList householdId={selectedHousehold.id} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invitations" className="space-y-4">
                <Card>
                  <CardHeader className="py-6">
                    <CardTitle>Invitations</CardTitle>
                    <CardDescription>Manage pending invitations to this household</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <HouseholdInvitationsList householdId={selectedHousehold.id} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Leave Household Dialog */}
      {selectedHousehold && dbUser && (
        <LeaveHouseholdDialog
          open={leaveDialogOpen}
          onOpenChange={setLeaveDialogOpen}
          householdId={selectedHousehold.id}
          householdName={selectedHousehold.name}
          userId={dbUser.id}
          onSuccess={handleLeaveSuccess}
        />
      )}

      {/* Delete Household Dialog */}
      {selectedHousehold && (
        <DeleteHouseholdDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          householdId={selectedHousehold.id}
          householdName={selectedHousehold.name}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  )
}

export default function HouseholdSettingsPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <HouseholdSettingsContent />
    </Suspense>
  )
}
