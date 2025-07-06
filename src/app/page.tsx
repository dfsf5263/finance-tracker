'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/transaction-form'
import { TransactionGrid } from '@/components/transaction-grid'
import { CSVUpload } from '@/components/csv-upload'
import { AnalyticsChart } from '@/components/analytics-chart'
import { ManagementInterface } from '@/components/management-interface'
import { Plus, Upload, BarChart3, Grid3x3, DollarSign, Settings } from 'lucide-react'
import { ThemeToggleButton } from '@/components/theme-toggle'

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
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'analytics' | 'management'>(
    'transactions'
  )
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [showCSVUpload, setShowCSVUpload] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleTransactionSubmit = async (
    transactionData: Omit<Transaction, 'id' | 'source' | 'user' | 'category' | 'type'>
  ) => {
    try {
      const url = editingTransaction
        ? `/api/transactions/${editingTransaction.id}`
        : '/api/transactions'

      const method = editingTransaction ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      })

      if (response.ok) {
        setShowTransactionForm(false)
        setEditingTransaction(null)
        setRefreshTrigger((prev) => prev + 1)
      }
    } catch (error) {
      console.error('Error saving transaction:', error)
    }
  }

  const handleEditTransaction = (transaction: Transaction) => {
    // Transform transaction with nested objects to format expected by form
    const formTransaction = {
      ...transaction,
      sourceId: transaction.sourceId || transaction.source?.id || '',
      userId: transaction.userId || transaction.user?.id || '',
      categoryId: transaction.categoryId || transaction.category?.id || '',
      typeId: transaction.typeId || transaction.type?.id || '',
    }
    setEditingTransaction(formTransaction)
    setShowTransactionForm(true)
  }

  const handleCSVUploadComplete = () => {
    setShowCSVUpload(false)
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card shadow-sm border-b border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Finance Tracker</h1>
                <p className="text-sm text-muted-foreground">Manage your financial transactions</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggleButton />
              <Button
                variant="outline"
                onClick={() => setShowCSVUpload(true)}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTransaction(null)
                  setShowTransactionForm(true)
                }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Transaction
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-3 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('management')}
              className={`flex items-center gap-2 px-3 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'management'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="w-4 h-4" />
              Management
            </button>
          </nav>
        </div>

        {activeTab === 'transactions' ? (
          <TransactionGrid
            onEditTransaction={handleEditTransaction}
            refreshTrigger={refreshTrigger}
          />
        ) : activeTab === 'analytics' ? (
          <AnalyticsChart />
        ) : (
          <ManagementInterface />
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

      <CSVUpload
        open={showCSVUpload}
        onClose={() => setShowCSVUpload(false)}
        onUploadComplete={handleCSVUploadComplete}
      />
    </div>
  )
}
