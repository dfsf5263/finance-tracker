'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http-utils'

interface LeaveHouseholdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  householdName: string
  userId: string
  onSuccess?: () => void
}

export function LeaveHouseholdDialog({
  open,
  onOpenChange,
  householdId,
  householdName,
  userId,
  onSuccess,
}: LeaveHouseholdDialogProps) {
  const [isLeaving, setIsLeaving] = useState(false)

  const handleLeave = async () => {
    setIsLeaving(true)
    try {
      const { error } = await apiFetch(`/api/households/${householdId}/members/${userId}`, {
        method: 'DELETE',
        showErrorToast: false,
        showRateLimitToast: true,
      })

      if (!error) {
        toast.success(`Successfully left ${householdName}`)
        onOpenChange(false)
        onSuccess?.()
      } else {
        console.error('Failed to leave household:', error)
        if (error.includes('Cannot remove the last owner')) {
          toast.error('Cannot leave as the last owner. Transfer ownership to another member first.')
        } else if (!error.includes('Rate limit exceeded')) {
          toast.error('Failed to leave household')
        }
      }
    } catch (error) {
      console.error('Failed to leave household:', error)
      toast.error('Failed to leave household')
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Leave Household
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to leave &quot;{householdName}&quot;?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Warning:</strong> After leaving this household, you will:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground space-y-1">
              <li>• Lose access to all household data and transactions</li>
              <li>• Need a new invitation from an owner to rejoin</li>
              <li>• No longer receive email notifications for this household</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLeaving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleLeave} disabled={isLeaving}>
            {isLeaving ? 'Leaving...' : 'Leave Household'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
