'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomDatePicker } from '@/components/ui/date-picker'
import { TransactionForm } from '@/components/transaction-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Edit,
  Trash2,
  Filter,
  Search,
  Tag,
  CreditCard,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  Upload,
  DollarSign,
} from 'lucide-react'
import { formatCurrency, formatDateFromISO } from '@/lib/utils'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { useHousehold } from '@/contexts/household-context'
import { invalidateActiveMonthCache } from '@/hooks/use-active-month'

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
  id: string
  accountId: string
  userId: string | null
  transactionDate: string
  postDate: string
  description: string
  categoryId: string
  typeId: string
  amount: number
  memo?: string
  householdId: string
  account?: Account
  user?: TransactionUser
  category?: TransactionCategory
  type?: TransactionType
  createdAt: string
  updatedAt: string
}

interface TransactionGridProps {
  refreshTrigger?: number
  onRefresh?: () => void
}

export function TransactionGrid({ refreshTrigger, onRefresh }: TransactionGridProps) {
  const { selectedHousehold } = useHousehold()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<TransactionUser[]>([])
  const [filters, setFilters] = useState({
    category: 'all',
    type: 'all',
    account: 'all',
    user: 'all',
    startDate: '',
    endDate: '',
    search: '',
  })
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchTransactions = async () => {
    if (!selectedHousehold) return
    setLoading(true)

    const params = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString(),
      householdId: selectedHousehold.id,
    })

    if (filters.category && filters.category !== 'all') params.append('category', filters.category)
    if (filters.type && filters.type !== 'all') params.append('type', filters.type)
    if (filters.account && filters.account !== 'all') params.append('account', filters.account)
    if (filters.user && filters.user !== 'all') params.append('user', filters.user)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    const { data, error } = await apiFetch<{
      transactions: Transaction[]
      pagination: { pages: number }
    }>(`/api/transactions?${params}`, {
      showErrorToast: false, // Handle errors manually
      showRateLimitToast: true, // Show rate limit toasts
    })

    if (data) {
      let filteredTransactions = data.transactions

      if (filters.search) {
        filteredTransactions = filteredTransactions.filter(
          (t: Transaction) =>
            t.description.toLowerCase().includes(filters.search.toLowerCase()) ||
            (t.account?.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
            (t.user?.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
            (t.category?.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
            (t.type?.name || '').toLowerCase().includes(filters.search.toLowerCase())
        )
      }

      setTransactions(filteredTransactions)
      setTotalPages(data.pagination.pages)
    } else if (error) {
      console.error('Error fetching transactions:', error)
      setTransactions([])
      setTotalPages(1)
      // Only show toast if it's not a rate limit error (already handled by apiFetch)
      if (!error.includes('Rate limit exceeded')) {
        toast.error('Failed to fetch transactions')
      }
    }

    setLoading(false)
  }

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

  useEffect(() => {
    fetchTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters, refreshTrigger, selectedHousehold])

  useEffect(() => {
    if (selectedHousehold) {
      fetchCategories()
      fetchTypes()
      fetchAccounts()
      fetchUsers()
    }
  }, [selectedHousehold, fetchCategories, fetchTypes, fetchAccounts, fetchUsers])

  const handleDeleteClick = (transaction: Transaction) => {
    setTransactionToDelete(transaction)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/transactions/${transactionToDelete.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchTransactions()
        onRefresh?.()
        // Invalidate active month cache to refresh dashboard components
        if (selectedHousehold?.id) {
          invalidateActiveMonthCache(selectedHousehold.id)
        }
        setDeleteDialogOpen(false)
        setTransactionToDelete(null)
      } else {
        console.error('Failed to delete transaction')
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({
      category: 'all',
      type: 'all',
      account: 'all',
      user: 'all',
      startDate: '',
      endDate: '',
      search: '',
    })
    setPage(1)
  }

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize))
    setPage(1) // Reset to first page when changing page size
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.category !== 'all') count++
    if (filters.type !== 'all') count++
    if (filters.account !== 'all') count++
    if (filters.user !== 'all') count++
    if (filters.startDate) count++
    if (filters.endDate) count++
    if (filters.search) count++
    return count
  }

  const handleTransactionSubmit = async (
    transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { amount: number }
  ) => {
    const url = editingTransaction
      ? `/api/transactions/${editingTransaction.id}`
      : '/api/transactions'

    const method = editingTransaction ? 'PUT' : 'POST'

    const { data, error } = await apiFetch<Transaction>(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
      showErrorToast: false, // Handle success/error toasts manually
      showRateLimitToast: true, // Show rate limit toasts
    })

    if (data) {
      // Success case
      setShowTransactionForm(false)
      setEditingTransaction(null)
      fetchTransactions()
      onRefresh?.()

      // Invalidate active month cache to refresh dashboard components
      if (selectedHousehold?.id) {
        invalidateActiveMonthCache(selectedHousehold.id)
      }

      // Show success toast
      toast.success(
        editingTransaction ? 'Transaction updated successfully' : 'Transaction created successfully'
      )
    } else if (error) {
      console.error('Error saving transaction:', error)
      // Only show toast if it's not a rate limit error (already handled by apiFetch)
      if (!error.includes('Rate limit exceeded')) {
        toast.error(error || 'Failed to save transaction')
      }
    }
  }

  const handleEditTransaction = (transaction: Transaction) => {
    // Transform transaction with nested objects to format expected by form
    const formTransaction = {
      ...transaction,
      accountId: transaction.accountId || transaction.account?.id || '',
      userId: transaction.userId || transaction.user?.id || '',
      categoryId: transaction.categoryId || transaction.category?.id || '',
      typeId: transaction.typeId || transaction.type?.id || '',
    }
    setEditingTransaction(formTransaction)
    setShowTransactionForm(true)
  }

  if (!selectedHousehold) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Please select a household to view transactions.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard/transactions/upload">
          <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Upload CSV</CardTitle>
                  <CardDescription>Import transactions from CSV file</CardDescription>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => {
            setEditingTransaction(null)
            setShowTransactionForm(true)
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Add Transaction</CardTitle>
                <CardDescription>Create a new transaction manually</CardDescription>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted rounded-xl">
        {/* Filter Header - Mobile Toggle */}
        <div className="flex items-center justify-between p-4 lg:hidden">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Filters
              {getActiveFilterCount() > 0 && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {getActiveFilterCount()}
                </span>
              )}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="p-2"
          >
            {filtersExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Filter Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ${
            filtersExpanded ? 'max-h-none' : 'max-h-0 lg:max-h-none'
          }`}
        >
          <div className="p-4 pt-0 lg:pt-4">
            {/* Desktop Filter Header */}
            <div className="hidden lg:flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium text-foreground">
                Filters
                {getActiveFilterCount() > 0 && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {getActiveFilterCount()}
                  </span>
                )}
              </span>
            </div>

            {/* Search Bar - Always Full Width */}
            <div className="mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Search className="w-3 h-3" />
                  Search
                </label>
                <Input
                  placeholder="Search transactions..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Dropdown Filters */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  Account
                </label>
                <Select
                  value={filters.account}
                  onValueChange={(value) => handleFilterChange('account', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  User
                </label>
                <Select
                  value={filters.user}
                  onValueChange={(value) => handleFilterChange('user', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Category
                </label>
                <Select
                  value={filters.category}
                  onValueChange={(value) => handleFilterChange('category', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Type
                </label>
                <Select
                  value={filters.type}
                  onValueChange={(value) => handleFilterChange('type', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filters */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Start Date</label>
                <CustomDatePicker
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange('startDate', date)}
                  placeholder="Select start date"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">End Date</label>
                <CustomDatePicker
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange('endDate', date)}
                  placeholder="Select end date"
                />
              </div>

              {/* Clear Button */}
              <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-medium text-foreground opacity-0">Actions</label>
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
      ) : (
        <div className="border border rounded-xl bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="p-3">Account</TableHead>
                <TableHead className="p-3">User</TableHead>
                <TableHead className="p-3">Transaction Date</TableHead>
                <TableHead className="p-3">Description</TableHead>
                <TableHead className="p-3">Category</TableHead>
                <TableHead className="p-3">Type</TableHead>
                <TableHead className="p-3 text-right">Amount</TableHead>
                <TableHead className="p-3 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="p-3 text-sm text-foreground">
                    {transaction.account?.name || 'Unknown'}
                  </TableCell>
                  <TableCell className="p-3 text-sm text-foreground">
                    {transaction.user?.name || 'Household'}
                  </TableCell>
                  <TableCell className="p-3 text-sm text-foreground">
                    {formatDateFromISO(transaction.transactionDate)}
                  </TableCell>
                  <TableCell className="p-3 text-sm text-foreground max-w-xs truncate">
                    {transaction.description}
                  </TableCell>
                  <TableCell className="p-3 text-sm text-foreground">
                    {transaction.category?.name || 'Unknown'}
                  </TableCell>
                  <TableCell className="p-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                      {transaction.type?.name || 'Unknown'}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`p-3 text-sm text-right font-medium ${
                      transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTransaction(transaction)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(transaction)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {transactions.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">No transactions found</div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <span>Show</span>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>items per page</span>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-4 text-sm text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <TransactionForm
        transaction={editingTransaction ?? undefined}
        open={showTransactionForm}
        onClose={() => {
          setShowTransactionForm(false)
          setEditingTransaction(null)
        }}
        onSubmit={handleTransactionSubmit}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {transactionToDelete && (
            <div className="my-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium">{transactionToDelete.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span
                    className={`font-medium ${
                      transactionToDelete.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(transactionToDelete.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {formatDateFromISO(transactionToDelete.transactionDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">
                    {transactionToDelete.category?.name || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
