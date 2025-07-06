'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface TransactionType {
  id?: string
  name: string
}

interface TypeFormProps {
  type?: TransactionType
  open: boolean
  onClose: () => void
  onSubmit: (type: Omit<TransactionType, 'id'>) => void
}

export function TypeForm({ type, open, onClose, onSubmit }: TypeFormProps) {
  const [formData, setFormData] = useState<Omit<TransactionType, 'id'>>({
    name: type?.name || '',
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
          <DialogTitle>{type ? 'Edit Transaction Type' : 'Add New Transaction Type'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{type ? 'Update' : 'Create'} Transaction Type</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
