'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Household {
  id?: string
  name: string
  annualBudget?: number | null
}

interface HouseholdFormProps {
  household?: Household
  open: boolean
  onClose: () => void
  onSubmit: (household: Omit<Household, 'id'>) => void
}

export function HouseholdForm({ household, open, onClose, onSubmit }: HouseholdFormProps) {
  const [formData, setFormData] = useState<Omit<Household, 'id'>>({
    name: '',
    annualBudget: undefined,
  })

  useEffect(() => {
    if (household) {
      setFormData({
        name: household.name || '',
        annualBudget: household.annualBudget || undefined,
      })
    } else {
      setFormData({
        name: '',
        annualBudget: undefined,
      })
    }
  }, [household, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleInputChange = (field: keyof typeof formData, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const formatCurrency = (value: string) => {
    // Remove all non-digit characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '')

    // Ensure only one decimal point
    const parts = numericValue.split('.')
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('')
    }

    return numericValue
  }

  const handleBudgetChange = (value: string) => {
    if (value === '') {
      handleInputChange('annualBudget', undefined)
      return
    }

    const formatted = formatCurrency(value)
    const numValue = parseFloat(formatted)

    if (!isNaN(numValue)) {
      handleInputChange('annualBudget', numValue)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{household ? 'Edit Household' : 'Add New Household'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <div className="mt-2">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter household name"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="annualBudget">Annual Budget (Optional)</Label>
            <div className="mt-2">
              <Input
                id="annualBudget"
                type="text"
                value={formData.annualBudget ? formData.annualBudget.toString() : ''}
                onChange={(e) => handleBudgetChange(e.target.value)}
                placeholder="Enter annual budget"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter amount in dollars (e.g., 50000 for $50,000)
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {household ? 'Update' : 'Create'} Household
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
