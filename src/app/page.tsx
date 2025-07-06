'use client'

import { useState } from 'react'
import Image from 'next/image'
import { TransactionGrid } from '@/components/transaction-grid'
import { AnalyticsChart } from '@/components/analytics-chart'
import { ManagementInterface } from '@/components/management-interface'
import { BarChart3, Grid3x3, Settings, Menu, X } from 'lucide-react'
import { ThemeToggleButton } from '@/components/theme-toggle'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'analytics' | 'management'>(
    'transactions'
  )
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleRefreshTransactions = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card shadow-sm border-b border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden">
              <Image
                src="/favicon.ico"
                alt="Finance Tracker Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 relative ${
                  activeTab === 'transactions'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                Transactions
                {activeTab === 'transactions' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 relative ${
                  activeTab === 'analytics'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
                {activeTab === 'analytics' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('management')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 relative ${
                  activeTab === 'management'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings className="w-4 h-4" />
                Management
                {activeTab === 'management' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              <ThemeToggleButton />
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-card border-b border">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <nav className="space-y-2">
              <button
                onClick={() => {
                  setActiveTab('transactions')
                  setMobileMenuOpen(false)
                }}
                className={`flex items-center gap-3 w-full px-3 py-3 rounded-md text-left transition-colors ${
                  activeTab === 'transactions'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Grid3x3 className="w-5 h-5" />
                Transactions
              </button>
              <button
                onClick={() => {
                  setActiveTab('analytics')
                  setMobileMenuOpen(false)
                }}
                className={`flex items-center gap-3 w-full px-3 py-3 rounded-md text-left transition-colors ${
                  activeTab === 'analytics'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Analytics
              </button>
              <button
                onClick={() => {
                  setActiveTab('management')
                  setMobileMenuOpen(false)
                }}
                className={`flex items-center gap-3 w-full px-3 py-3 rounded-md text-left transition-colors ${
                  activeTab === 'management'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Settings className="w-5 h-5" />
                Management
              </button>
            </nav>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'transactions' ? (
          <TransactionGrid refreshTrigger={refreshTrigger} onRefresh={handleRefreshTransactions} />
        ) : activeTab === 'analytics' ? (
          <AnalyticsChart />
        ) : (
          <ManagementInterface />
        )}
      </div>
    </div>
  )
}
