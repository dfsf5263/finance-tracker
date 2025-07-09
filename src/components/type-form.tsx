'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TransactionType {
  id?: string
  name: string
  isOutflow?: boolean
  householdId?: string
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
    isOutflow: type?.isOutflow !== undefined ? type.isOutflow : true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (open) {
      setFormData({
        name: type?.name || '',
        isOutflow: type?.isOutflow !== undefined ? type.isOutflow : true,
      })
    }
  }, [open, type])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{type ? 'Edit Transaction Type' : 'Add New Transaction Type'}</DialogTitle>
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

          <div>
            <Label htmlFor="flow-direction">Flow Direction</Label>
            <div className="mt-2">
              <Select
                value={formData.isOutflow ? 'outflow' : 'inflow'}
                onValueChange={(value: string) =>
                  handleInputChange('isOutflow', value === 'outflow')
                }
              >
                <SelectTrigger id="flow-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outflow">Outflow (Expenses)</SelectItem>
                  <SelectItem value="inflow">Inflow (Income)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {type ? 'Update' : 'Create'} Transaction Type
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
