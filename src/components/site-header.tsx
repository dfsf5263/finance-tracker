import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { ModeToggle } from '@/components/mode-toggle'
import { useHousehold } from '@/contexts/household-context'
import { Home } from 'lucide-react'

export function SiteHeader({ title }: { title: string }) {
  const { state } = useSidebar()
  const { selectedHousehold, isLoading } = useHousehold()
  const isCollapsed = state === 'collapsed'

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
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
