'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface TransactionUser {
  id?: string
  name: string
  annualBudget?: string | number | null
  householdId?: string
}

interface TransactionUserFormProps {
  user?: TransactionUser
  open: boolean
  onClose: () => void
  onSubmit: (user: Omit<TransactionUser, 'id'>) => void
}

export function TransactionUserForm({ user, open, onClose, onSubmit }: TransactionUserFormProps) {
  const [formData, setFormData] = useState<Omit<TransactionUser, 'id'>>({
    name: user?.name || '',
    annualBudget: user?.annualBudget || '',
  })

  // Update form data when user prop changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        annualBudget: user.annualBudget || '',
      })
    } else {
      // Reset form for new user
      setFormData({
        name: '',
        annualBudget: '',
      })
    }
  }, [user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitData = {
      name: formData.name,
      annualBudget: formData.annualBudget,
    }
    onSubmit(submitData)
  }

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <div className="mt-2">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., John Smith"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                The person who makes transactions (cardholder, account holder, etc.)
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="annualBudget">Annual Budget (optional)</Label>
            <div className="mt-2">
              <Input
                id="annualBudget"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.annualBudget || ''}
                onChange={(e) => handleInputChange('annualBudget', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {user ? 'Update' : 'Create'} User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
