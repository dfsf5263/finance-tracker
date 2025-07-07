'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface TransactionCategory {
  id?: string
  name: string
}

interface TransactionCategoryFormProps {
  category?: TransactionCategory
  open: boolean
  onClose: () => void
  onSubmit: (category: Omit<TransactionCategory, 'id'>) => void
}

export function TransactionCategoryForm({
  category,
  open,
  onClose,
  onSubmit,
}: TransactionCategoryFormProps) {
  const [formData, setFormData] = useState<Omit<TransactionCategory, 'id'>>({
    name: category?.name || '',
  })

  // Update form data when category prop changes
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
      })
    } else {
      // Reset form for new category
      setFormData({
        name: '',
      })
    }
  }, [category])

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
          <DialogTitle>{category ? 'Edit Category' : 'Add New Category'}</DialogTitle>
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
            <Button type="submit">{category ? 'Update' : 'Create'} Category</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
