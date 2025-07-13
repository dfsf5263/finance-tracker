'use client'

import * as React from 'react'
import { Home } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useHousehold } from '@/contexts/household-context'
import { getRoleLabel } from '@/lib/role-utils'
import { Badge } from '@/components/ui/badge'

export function HouseholdSelector() {
  const { households, selectedHousehold, selectHousehold, isLoading, getUserRole } = useHousehold()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Home className="h-4 w-4" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  if (households.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Home className="h-4 w-4" />
        <span className="text-sm text-muted-foreground">No households</span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">Household</Label>
      <Select
        value={selectedHousehold?.id || ''}
        onValueChange={(value) => {
          const household = households.find((h) => h.id === value)
          if (household) {
            selectHousehold(household)
          }
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger>
              <div className="flex items-center gap-2 overflow-x-hidden">
                <Home className="h-4 w-4 flex-shrink-0" />
                <SelectValue placeholder="Select household..." />
              </div>
            </SelectTrigger>
          </TooltipTrigger>
          {selectedHousehold && (
            <TooltipContent>
              <p>{selectedHousehold.name}</p>
            </TooltipContent>
          )}
        </Tooltip>
        <SelectContent>
          {households.map((household) => (
            <SelectItem key={household.id} value={household.id}>
              <div className="flex items-center gap-2 w-full">
                <Badge variant="outline" className="text-xs">
                  {getRoleLabel(getUserRole(household.id))}
                </Badge>
                <span title={household.name}>{household.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
