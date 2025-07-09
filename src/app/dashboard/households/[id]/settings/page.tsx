'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HouseholdMembersList } from '@/components/household-members-list'
import { HouseholdInvitationsList } from '@/components/household-invitations-list'
import { HouseholdOverview } from '@/components/household-overview'
import { useHousehold } from '@/contexts/household-context'

export default function HouseholdSettingsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const householdId = params.id as string
  const { selectedHousehold } = useHousehold()

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

  if (!selectedHousehold || selectedHousehold.id !== householdId) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <p className="text-muted-foreground">Household not found</p>
            </div>
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
            <div>
              <p className="text-muted-foreground">
                Manage {selectedHousehold.name} settings, members, and invitations
              </p>
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
                    <HouseholdMembersList householdId={householdId} />
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
                    <HouseholdInvitationsList householdId={householdId} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
