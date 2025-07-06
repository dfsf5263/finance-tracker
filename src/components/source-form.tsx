'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Source {
  id?: string
  name: string
}

interface SourceFormProps {
  source?: Source
  open: boolean
  onClose: () => void
  onSubmit: (source: Omit<Source, 'id'>) => void
}

export function SourceForm({ source, open, onClose, onSubmit }: SourceFormProps) {
  const [formData, setFormData] = useState<Omit<Source, 'id'>>({
    name: source?.name || '',
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
          <DialogTitle>{source ? 'Edit Source' : 'Add New Source'}</DialogTitle>
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
            <Button type="submit">{source ? 'Update' : 'Create'} Source</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
