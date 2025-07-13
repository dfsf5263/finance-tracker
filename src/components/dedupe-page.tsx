'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CustomDatePicker } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { Trash2, Search, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { useHousehold } from '@/contexts/household-context'
import { canManageData } from '@/lib/role-utils'
import { apiFetch } from '@/lib/http-utils'
import { toast } from 'sonner'
import { DuplicateTransactionGrid } from '@/components/duplicate-transaction-grid'
import { DuplicatePair } from '@/lib/duplicate-detector'

interface DuplicateStats {
  total: number
  highRisk: number
  mediumRisk: number
  lowRisk: number
}

interface DuplicateResponse {
  duplicatePairs: DuplicatePair[]
  stats: DuplicateStats
  totalTransactions: number
  dateRange: {
    startDate: string | null
    endDate: string | null
  }
}

export function DeDupePage() {
  const { selectedHousehold, getUserRole } = useHousehold()
  const userRole = getUserRole()
  const canEdit = canManageData(userRole)
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to 3 months ago
    const date = new Date()
    date.setMonth(date.getMonth() - 3)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DuplicateResponse | null>(null)

  const handleAnalyze = async () => {
    if (!selectedHousehold) {
      toast.error('Please select a household first')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        householdId: selectedHousehold.id,
      })

      if (startDate) {
        params.append('startDate', startDate)
      }
      if (endDate) {
        params.append('endDate', endDate)
      }

      const { data, error } = await apiFetch<DuplicateResponse>(
        `/api/transactions/duplicates?${params}`,
        {
          showErrorToast: false,
          showRateLimitToast: true,
        }
      )

      if (data) {
        setResults(data)
        if (data.stats.total === 0) {
          toast.success('No potential duplicates found!')
        } else {
          toast.success(`Found ${data.stats.total} potential duplicate pairs`)
        }
      } else if (error) {
        console.error('Failed to analyze duplicates:', error)
        if (!error.includes('Rate limit exceeded')) {
          toast.error('Failed to analyze duplicates')
        }
      }
    } catch (error) {
      console.error('Failed to analyze duplicates:', error)
      toast.error('Failed to analyze duplicates')
    } finally {
      setLoading(false)
    }
  }

  const handleTransactionDeleted = () => {
    // Re-run analysis to refresh results
    handleAnalyze()
  }

  if (!selectedHousehold) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Transaction Duplicate Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Please select a household to analyze transactions for duplicates.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!canEdit) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-semibold">View Only Access</h3>
              <p className="text-muted-foreground">
                You have view-only access to this household and cannot run duplicate analysis.
                Duplicate detection is a data management feature that could lead to transaction
                deletion.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="p-4">
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Transaction Duplicate Detection
          </CardTitle>
          <CardDescription>
            This tool helps identify potential duplicate transactions by analyzing transaction
            amounts, dates, and descriptions. Then you get the choice to delete if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-sm text-foreground">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Groups transactions by identical amounts</li>
                <li>Compares transactions within a 5-day window</li>
                <li>Calculates similarity based on date proximity and description matching</li>
                <li>Provides color-coded risk levels to help you identify true duplicates</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Section */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="text-lg">Analysis Filters</CardTitle>
          <CardDescription>
            Select a date range to limit the transactions analyzed for duplicates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <CustomDatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <CustomDatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="Select end date"
              />
            </div>
            <Button onClick={handleAnalyze} disabled={loading} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {loading ? 'Analyzing...' : 'Analyze Transactions'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <>
          {/* Summary Stats */}
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Analysis Results
              </CardTitle>
              <CardDescription>
                Found {results.stats.total} potential duplicate pairs out of{' '}
                {results.totalTransactions} transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{results.stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Pairs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{results.stats.highRisk}</div>
                  <div className="text-sm text-muted-foreground">High Risk</div>
                  <Badge variant="destructive" className="text-xs mt-1">
                    75-100%
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {results.stats.mediumRisk}
                  </div>
                  <div className="text-sm text-muted-foreground">Medium Risk</div>
                  <Badge variant="default" className="text-xs mt-1">
                    25-75%
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{results.stats.lowRisk}</div>
                  <div className="text-sm text-muted-foreground">Low Risk</div>
                  <Badge variant="secondary" className="text-xs mt-1">
                    0-25%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Duplicate Grid */}
          {results.duplicatePairs.length > 0 ? (
            <DuplicateTransactionGrid
              duplicatePairs={results.duplicatePairs}
              onTransactionDeleted={handleTransactionDeleted}
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Trash2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
                  <p className="text-muted-foreground">
                    Great! No potential duplicate transactions were found in the selected date
                    range.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
