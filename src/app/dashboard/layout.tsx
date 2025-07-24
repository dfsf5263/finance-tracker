'use client'

import { usePathname } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { HouseholdProvider, useHousehold } from '@/contexts/household-context'
import { HouseholdCreationModal } from '@/components/household-creation-modal'
import { AuthGuard } from '@/components/auth-guard'
import { getPageTitle } from '@/lib/route-titles'

function DashboardContent({ children, title }: { children: React.ReactNode; title: string }) {
  const { requiresHouseholdCreation, isLoading, households } = useHousehold()
  const isFirstTime = households.length === 0 && !isLoading

  return (
    <>
      <SidebarProvider
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 72)',
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader title={title} />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>

      <HouseholdCreationModal open={requiresHouseholdCreation} isFirstTime={isFirstTime} />
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <AuthGuard>
      <HouseholdProvider>
        <DashboardContent title={title}>{children}</DashboardContent>
      </HouseholdProvider>
    </AuthGuard>
  )
}
