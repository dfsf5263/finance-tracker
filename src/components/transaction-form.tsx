'use client'

import { useState, useEffect } from 'react'
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

interface Account {
  id: string
  name: string
}

interface TransactionUser {
  id: string
  name: string
}

interface TransactionCategory {
  id: string
  name: string
}

interface TransactionType {
  id: string
  name: string
}

interface Transaction {
  id?: string
  accountId: string
  userId: string
  transactionDate: string
  postDate: string
  description: string
  categoryId: string
  typeId: string
  amount: number
  memo?: string
  account?: Account
  user?: TransactionUser
  category?: TransactionCategory
  type?: TransactionType
}

interface TransactionFormProps {
  transaction?: Transaction
  open: boolean
  onClose: () => void
  onSubmit: (transaction: Omit<Transaction, 'id'>) => void
}

export function TransactionForm({ transaction, open, onClose, onSubmit }: TransactionFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<TransactionUser[]>([])
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])

  const [formData, setFormData] = useState<Omit<Transaction, 'id'>>({
    accountId: transaction?.accountId || '',
    userId: transaction?.userId || '',
    transactionDate: transaction?.transactionDate
      ? formatDateForInput(parseLocalDate(transaction.transactionDate))
      : formatDateForInput(new Date()),
    postDate: transaction?.postDate
      ? formatDateForInput(parseLocalDate(transaction.postDate))
      : formatDateForInput(new Date()),
    description: transaction?.description || '',
    categoryId: transaction?.categoryId || '',
    typeId: transaction?.typeId || '',
    amount: transaction?.amount || 0,
    memo: transaction?.memo || '',
  })

  useEffect(() => {
    if (open) {
      fetchAccounts()
      fetchUsers()
      fetchCategories()
      fetchTypes()
    }
  }, [open])

  // Update form data when transaction prop changes
  useEffect(() => {
    if (transaction) {
      setFormData({
        accountId: transaction.accountId || '',
        userId: transaction.userId || '',
        transactionDate: transaction.transactionDate
          ? formatDateForInput(parseLocalDate(transaction.transactionDate))
          : formatDateForInput(new Date()),
        postDate: transaction.postDate
          ? formatDateForInput(parseLocalDate(transaction.postDate))
          : formatDateForInput(new Date()),
        description: transaction.description || '',
        categoryId: transaction.categoryId || '',
        typeId: transaction.typeId || '',
        amount: transaction.amount || 0,
        memo: transaction.memo || '',
      })
    } else {
      // Reset form for new transaction
      setFormData({
        accountId: '',
        userId: '',
        transactionDate: formatDateForInput(new Date()),
        postDate: formatDateForInput(new Date()),
        description: '',
        categoryId: '',
        typeId: '',
        amount: 0,
        memo: '',
      })
    }
  }, [transaction])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data)
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchTypes = async () => {
    try {
      const response = await fetch('/api/types')
      if (response.ok) {
        const data = await response.json()
        setTypes(data)
      }
    } catch (error) {
      console.error('Failed to fetch types:', error)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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
            <Select
              value={formData.accountId}
              onValueChange={(value) => handleInputChange('accountId', value)}
            >
              <SelectTrigger>
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
          </div>

          <div>
            <Label htmlFor="user">User</Label>
            <Select
              value={formData.userId}
              onValueChange={(value) => handleInputChange('userId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="transactionDate">Transaction Date</Label>
              <CustomDatePicker
                value={formData.transactionDate}
                onChange={(date) => handleInputChange('transactionDate', date)}
                placeholder="Select transaction date"
              />
            </div>
            <div>
              <Label htmlFor="postDate">Post Date</Label>
              <CustomDatePicker
                value={formData.postDate}
                onChange={(date) => handleInputChange('postDate', date)}
                placeholder="Select post date"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => handleInputChange('categoryId', value)}
            >
              <SelectTrigger>
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
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.typeId}
              onValueChange={(value) => handleInputChange('typeId', value)}
            >
              <SelectTrigger>
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
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', parseFloat(e.target.value))}
              required
            />
          </div>

          <div>
            <Label htmlFor="memo">Memo (Optional)</Label>
            <Input
              id="memo"
              value={formData.memo}
              onChange={(e) => handleInputChange('memo', e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="outline">
              {transaction ? 'Update' : 'Create'} Transaction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
