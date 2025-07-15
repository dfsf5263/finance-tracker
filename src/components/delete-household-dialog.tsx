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
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http-utils'

interface DeleteHouseholdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  householdName: string
  onSuccess?: () => void
}

export function DeleteHouseholdDialog({
  open,
  onOpenChange,
  householdId,
  householdName,
  onSuccess,
}: DeleteHouseholdDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const { error } = await apiFetch(`/api/households/${householdId}`, {
        method: 'DELETE',
        showErrorToast: false,
        showRateLimitToast: true,
      })

      if (!error) {
        toast.success('Household deleted successfully')
        onOpenChange(false)
        onSuccess?.()
      } else {
        console.error('Failed to delete household:', error)
        if (!error.includes('Rate limit exceeded')) {
          toast.error('Failed to delete household')
        }
      }
    } catch (error) {
      console.error('Failed to delete household:', error)
      toast.error('Failed to delete household')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete Household
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{householdName}&quot;?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-destructive/10 p-4">
            <p className="text-sm text-destructive font-medium">
              <strong>Warning:</strong> This action cannot be undone.
            </p>
            <ul className="mt-2 text-sm text-destructive space-y-1">
              <li>• All household data will be permanently deleted</li>
              <li>• All transactions, categories, and accounts will be lost</li>
              <li>• All members will lose access immediately</li>
              <li>• This cannot be recovered</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Household'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
