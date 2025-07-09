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
import { useHousehold } from '@/contexts/household-context'

export function HouseholdSelector() {
  const { households, selectedHousehold, selectHousehold, isLoading } = useHousehold()

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
        <SelectTrigger>
          <div className="flex items-center gap-2 overflow-x-hidden">
            <Home className="h-4 w-4" />
            <SelectValue placeholder="Select household..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          {households.map((household) => (
            <SelectItem key={household.id} value={household.id}>
              <span title={household.name}>{household.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
