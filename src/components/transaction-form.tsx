'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CustomDatePicker } from '@/components/ui/date-picker'
import { formatDateForInput, parseLocalDate } from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'

interface Account {
  id: string
  name: string
  householdId: string
}

interface TransactionUser {
  id: string
  name: string
  householdId: string
}

interface TransactionCategory {
  id: string
  name: string
  householdId: string
}

interface TransactionType {
  id: string
  name: string
  householdId: string
}

interface Transaction {
  id?: string
  accountId: string
  userId: string | null
  transactionDate: string
  postDate: string
  description: string
  categoryId: string
  typeId: string
  amount: number | string
  memo?: string
  householdId: string
  account?: Account
  user?: TransactionUser
  category?: TransactionCategory
  type?: TransactionType
}

interface TransactionFormProps {
  transaction?: Transaction
  open: boolean
  onClose: () => void
  onSubmit: (transaction: Omit<Transaction, 'id'> & { amount: number }) => void
}

interface ValidationErrors {
  accountId?: string
  transactionDate?: string
  description?: string
  categoryId?: string
  typeId?: string
  amount?: string
}

export function TransactionForm({ transaction, open, onClose, onSubmit }: TransactionFormProps) {
  const { selectedHousehold } = useHousehold()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<TransactionUser[]>([])
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])
  const [errors, setErrors] = useState<ValidationErrors>({})

  const [formData, setFormData] = useState<Omit<Transaction, 'id'> & { userId: string }>({
    accountId: transaction?.accountId || '',
    userId: transaction?.userId || '__none__',
    transactionDate: transaction?.transactionDate
      ? formatDateForInput(parseLocalDate(transaction.transactionDate))
      : formatDateForInput(new Date()),
    postDate: transaction?.postDate ? formatDateForInput(parseLocalDate(transaction.postDate)) : '',
    description: transaction?.description || '',
    categoryId: transaction?.categoryId || '',
    typeId: transaction?.typeId || '',
    amount: transaction?.amount || '',
    memo: transaction?.memo || '',
    householdId: transaction?.householdId || selectedHousehold?.id || '',
  })

  // Update form data when transaction prop changes
  useEffect(() => {
    if (transaction) {
      setFormData({
        accountId: transaction.accountId || '',
        userId: transaction.userId || '__none__',
        transactionDate: transaction.transactionDate
          ? formatDateForInput(parseLocalDate(transaction.transactionDate))
          : formatDateForInput(new Date()),
        postDate: transaction.postDate
          ? formatDateForInput(parseLocalDate(transaction.postDate))
          : '',
        description: transaction.description || '',
        categoryId: transaction.categoryId || '',
        typeId: transaction.typeId || '',
        amount: transaction.amount || '',
        memo: transaction.memo || '',
        householdId: transaction.householdId || selectedHousehold?.id || '',
      })
    } else {
      // Reset form for new transaction
      setFormData({
        accountId: '',
        userId: '__none__',
        transactionDate: formatDateForInput(new Date()),
        postDate: '',
        description: '',
        categoryId: '',
        typeId: '',
        amount: '',
        memo: '',
        householdId: selectedHousehold?.id || '',
      })
    }
    setErrors({}) // Reset errors when transaction changes
  }, [transaction, selectedHousehold])

  const fetchAccounts = useCallback(async () => {
    if (!selectedHousehold) return
    try {
      const response = await fetch(`/api/accounts?householdId=${selectedHousehold.id}`)
      if (response.ok) {
        const data = await response.json()
        setAccounts(data)
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    }
  }, [selectedHousehold])

  const fetchUsers = useCallback(async () => {
    if (!selectedHousehold) return
    try {
      const response = await fetch(`/api/users?householdId=${selectedHousehold.id}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }, [selectedHousehold])

  const fetchCategories = useCallback(async () => {
    if (!selectedHousehold) return
    try {
      const response = await fetch(`/api/categories?householdId=${selectedHousehold.id}`)
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }, [selectedHousehold])

  const fetchTypes = useCallback(async () => {
    if (!selectedHousehold) return
    try {
      const response = await fetch(`/api/types?householdId=${selectedHousehold.id}`)
      if (response.ok) {
        const data = await response.json()
        setTypes(data)
      }
    } catch (error) {
      console.error('Failed to fetch types:', error)
    }
  }, [selectedHousehold])

  useEffect(() => {
    if (open && selectedHousehold) {
      fetchAccounts()
      fetchUsers()
      fetchCategories()
      fetchTypes()
      setErrors({}) // Reset errors when opening
    }
  }, [open, selectedHousehold, fetchAccounts, fetchUsers, fetchCategories, fetchTypes])

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.accountId) {
      newErrors.accountId = 'Account is required'
    }
    if (!formData.transactionDate) {
      newErrors.transactionDate = 'Transaction date is required'
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }
    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required'
    }
    if (!formData.typeId) {
      newErrors.typeId = 'Type is required'
    }
    if (!formData.amount || formData.amount === '') {
      newErrors.amount = 'Amount is required'
    } else {
      const amountNum = parseFloat(formData.amount.toString())
      if (isNaN(amountNum)) {
        newErrors.amount = 'Amount must be a valid number'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const submitData = {
      ...formData,
      userId: formData.userId === '__none__' || !formData.userId ? null : formData.userId, // Convert __none__ or empty string to null
      amount:
        typeof formData.amount === 'string' ? parseFloat(formData.amount) || 0 : formData.amount,
      postDate: formData.postDate || formData.transactionDate, // Default to transaction date if not provided
    }
    onSubmit(submitData)
  }

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  if (!selectedHousehold) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{transaction ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
          </DialogHeader>
          <div className="p-6 text-center">
            <p className="text-muted-foreground">
              Please select a household to manage transactions.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="account">Account</Label>
            <div className="mt-2">
              <Select
                value={formData.accountId}
                onValueChange={(value) => handleInputChange('accountId', value)}
              >
                <SelectTrigger aria-invalid={!!errors.accountId}>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && (
                <p className="text-sm text-destructive mt-1">{errors.accountId}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="user">User (optional)</Label>
            <div className="mt-2">
              <Select
                value={formData.userId}
                onValueChange={(value) => handleInputChange('userId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="transactionDate">Transaction Date</Label>
              <div className="mt-2">
                <CustomDatePicker
                  value={formData.transactionDate}
                  onChange={(date) => handleInputChange('transactionDate', date)}
                  placeholder="Select transaction date"
                />
                {errors.transactionDate && (
                  <p className="text-sm text-destructive mt-1">{errors.transactionDate}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="postDate">Post Date (optional)</Label>
              <div className="mt-2">
                <CustomDatePicker
                  value={formData.postDate}
                  onChange={(date) => handleInputChange('postDate', date)}
                  placeholder="Select post date"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <div className="mt-2">
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">{errors.description}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <div className="mt-2">
              <Select
                value={formData.categoryId}
                onValueChange={(value) => handleInputChange('categoryId', value)}
              >
                <SelectTrigger aria-invalid={!!errors.categoryId}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-destructive mt-1">{errors.categoryId}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <div className="mt-2">
              <Select
                value={formData.typeId}
                onValueChange={(value) => handleInputChange('typeId', value)}
              >
                <SelectTrigger aria-invalid={!!errors.typeId}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.typeId && <p className="text-sm text-destructive mt-1">{errors.typeId}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <div className="mt-2">
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="memo">Memo (optional)</Label>
            <div className="mt-2">
              <Input
                id="memo"
                value={formData.memo}
                onChange={(e) => handleInputChange('memo', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {transaction ? 'Update' : 'Create'} Transaction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
