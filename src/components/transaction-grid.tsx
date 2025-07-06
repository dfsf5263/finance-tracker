'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Edit, Trash2, Filter, Search, Calendar, Tag, Building2, User } from 'lucide-react'
import { formatCurrency, formatDate, parseLocalDate } from '@/lib/utils'

interface Source {
  id: string
  name: string
}

interface User {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
}

interface TransactionType {
  id: string
  name: string
}

interface Transaction {
  id: string
  sourceId: string
  userId: string
  transactionDate: string
  postDate: string
  description: string
  categoryId: string
  typeId: string
  amount: number
  memo?: string
  source?: Source
  user?: User
  category?: Category
  type?: TransactionType
  createdAt: string
  updatedAt: string
}

interface TransactionGridProps {
  onEditTransaction: (transaction: Transaction) => void
  refreshTrigger?: number
}

export function TransactionGrid({ onEditTransaction, refreshTrigger }: TransactionGridProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [filters, setFilters] = useState({
    category: 'all',
    type: 'all',
    source: 'all',
    user: 'all',
    startDate: '',
    endDate: '',
    search: '',
  })

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      })

      if (filters.category && filters.category !== 'all')
        params.append('category', filters.category)
      if (filters.type && filters.type !== 'all') params.append('type', filters.type)
      if (filters.source && filters.source !== 'all') params.append('source', filters.source)
      if (filters.user && filters.user !== 'all') params.append('user', filters.user)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/transactions?${params}`)
      if (response.ok) {
        const data = await response.json()
        let filteredTransactions = data.transactions

        if (filters.search) {
          filteredTransactions = filteredTransactions.filter(
            (t: Transaction) =>
              t.description.toLowerCase().includes(filters.search.toLowerCase()) ||
              (t.source?.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
              (t.user?.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
              (t.category?.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
              (t.type?.name || '').toLowerCase().includes(filters.search.toLowerCase())
          )
        }

        setTransactions(filteredTransactions)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
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

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources')
      if (response.ok) {
        const data = await response.json()
        setSources(data)
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error)
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

  useEffect(() => {
    fetchTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters, refreshTrigger])

  useEffect(() => {
    fetchCategories()
    fetchTypes()
    fetchSources()
    fetchUsers()
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        const response = await fetch(`/api/transactions/${id}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          fetchTransactions()
        }
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
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
      source: 'all',
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 p-4 bg-muted rounded-lg">
        <div className="flex flex-col gap-1 min-w-[200px] flex-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1">
            <Search className="w-3 h-3" />
            Search
          </label>
          <Input
            placeholder="Search transactions..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            Source
          </label>
          <Select
            value={filters.source}
            onValueChange={(value) => handleFilterChange('source', value)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.name}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1">
            <User className="w-3 h-3" />
            User
          </label>
          <Select value={filters.user} onValueChange={(value) => handleFilterChange('user', value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.name}>
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Type
          </label>
          <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type.id} value={type.name}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Start Date
          </label>
          <div className="relative">
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-[150px] pr-10"
            />
            <Calendar className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            End Date
          </label>
          <div className="relative">
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-[150px] pr-10"
            />
            <Calendar className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground opacity-0">Actions</label>
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
      ) : (
        <div className="border border rounded-lg overflow-hidden bg-card">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-left text-sm font-medium text-foreground">Source</th>
                <th className="p-3 text-left text-sm font-medium text-foreground">User</th>
                <th className="p-3 text-left text-sm font-medium text-foreground">
                  Transaction Date
                </th>
                <th className="p-3 text-left text-sm font-medium text-foreground">Description</th>
                <th className="p-3 text-left text-sm font-medium text-foreground">Category</th>
                <th className="p-3 text-left text-sm font-medium text-foreground">Type</th>
                <th className="p-3 text-right text-sm font-medium text-foreground">Amount</th>
                <th className="p-3 text-center text-sm font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-muted/50">
                  <td className="p-3 text-sm text-foreground">
                    {transaction.source?.name || 'Unknown'}
                  </td>
                  <td className="p-3 text-sm text-foreground">
                    {transaction.user?.name || 'Unknown'}
                  </td>
                  <td className="p-3 text-sm text-foreground">
                    {formatDate(parseLocalDate(transaction.transactionDate))}
                  </td>
                  <td className="p-3 text-sm text-foreground max-w-xs truncate">
                    {transaction.description}
                  </td>
                  <td className="p-3 text-sm text-foreground">
                    {transaction.category?.name || 'Unknown'}
                  </td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                      {transaction.type?.name || 'Unknown'}
                    </span>
                  </td>
                  <td
                    className={`p-3 text-sm text-right font-medium ${
                      transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditTransaction(transaction)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(transaction.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  )
}
