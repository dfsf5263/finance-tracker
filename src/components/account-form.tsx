'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface TransactionAccount {
  id?: string
  name: string
  householdId?: string
}

interface AccountFormProps {
  account?: TransactionAccount
  open: boolean
  onClose: () => void
  onSubmit: (account: Omit<TransactionAccount, 'id'>) => void
}

export function AccountForm({ account, open, onClose, onSubmit }: AccountFormProps) {
  const [formData, setFormData] = useState<Omit<TransactionAccount, 'id'>>({
    name: account?.name || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add New Account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <div className="mt-2">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {account ? 'Update' : 'Create'} Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
