'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Home } from 'lucide-react'
import { useHousehold } from '@/contexts/household-context'
import { toast } from 'sonner'
import { useUser } from '@clerk/nextjs'

interface HouseholdCreationModalProps {
  open: boolean
  isFirstTime?: boolean
}

export function HouseholdCreationModal({ open, isFirstTime = false }: HouseholdCreationModalProps) {
  const { completeHouseholdCreation } = useHousehold()
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    annualBudget: '',
  })

  const getDisplayName = () => {
    if (!user) return 'User'
    return (
      user.fullName ||
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.firstName ||
      'User'
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Household name is required')
      return
    }

    setIsSubmitting(true)

    try {
      const submitData: { name: string; annualBudget?: number } = { name: formData.name.trim() }

      if (formData.annualBudget.trim()) {
        const budgetValue = parseFloat(formData.annualBudget)
        if (!isNaN(budgetValue)) {
          submitData.annualBudget = budgetValue
        }
      }

      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        toast.success('Household created successfully!')
        setFormData({ name: '', annualBudget: '' })
        await completeHouseholdCreation()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to create household')
      }
    } catch (error) {
      console.error('Failed to create household:', error)
      toast.error('Failed to create household')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
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
    const formatted = formatCurrency(value)
    handleInputChange('annualBudget', formatted)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent className="sm:max-w-[425px]" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start gap-2">
            <Home className="h-5 w-5 text-primary mt-0.5" />
            <DialogTitle>
              {isFirstTime ? (
                <div className="space-y-1">
                  <div>Welcome {getDisplayName()}!</div>
                  <div className="text-base font-medium">Create your first household</div>
                </div>
              ) : (
                'Create a Household'
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {isFirstTime ? (
            <p className="text-sm text-muted-foreground">
              To get started with managing your finances, you need to create at least one household.
              A household represents a financial unit like your family, roommates, or personal
              finances.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You need at least one household to continue using the application. Please create a new
              household to proceed.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Household Name *</Label>
              <div className="mt-2">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Smith Family, My Finances, Roommates"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="annualBudget">Annual Budget (Optional)</Label>
              <div className="mt-2">
                <Input
                  id="annualBudget"
                  type="text"
                  value={formData.annualBudget}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  placeholder="Enter annual budget"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter amount in dollars (e.g., 50000 for $50,000)
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="w-full"
              >
                {isSubmitting ? 'Creating...' : 'Create Household'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
