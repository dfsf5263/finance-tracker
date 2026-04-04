'use client'

import { isValidCsvFile, isValidExcelFile, parseExcelToRows } from '@/lib/file-utils'
import React, { useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileText,
  AlertCircle,
  Download,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { displayDate, mdyToISO, isValidDateMDY, todayLocal } from '@/lib/date-utils'
import { apiFetch } from '@/lib/http-utils'
import { useHousehold } from '@/contexts/household-context'
import { invalidateActiveMonthCache } from '@/hooks/use-active-month'
import { canManageData } from '@/lib/role-utils'
import {
  FailedTransactionsGrid,
  type FailureDetail,
  type FailureIssue,
} from '@/components/failed-transactions-grid'

interface BulkUploadPageProps {
  onUploadComplete: () => void
}

interface ParsedTransaction {
  account: string
  user: string
  transactionDate: string
  postDate: string
  description: string
  category: string
  type: string
  amount: string
  memo?: string
  rowId: string
}

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

interface ColumnMapping {
  csvHeader: string
  mappedField: keyof ParsedTransaction | 'skip'
  confidence: 'high' | 'medium' | 'low'
  sampleData: string
}

// Normalize header names to handle case and space variations
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, '')
}

// Map normalized headers to expected field names
const headerMapping: Record<string, keyof ParsedTransaction> = {
  account: 'account',
  user: 'user',
  transactiondate: 'transactionDate',
  postdate: 'postDate',
  description: 'description',
  category: 'category',
  type: 'type',
  amount: 'amount',
  memo: 'memo',
}

// Helper function to convert MM/DD/YYYY to ISO format (YYYY-MM-DD)
function convertFileDateToISO(csvDate: string): string {
  if (!csvDate || !isValidDateMDY(csvDate)) {
    return ''
  }
  return mdyToISO(csvDate) ?? ''
}

export function BulkUploadPage({ onUploadComplete }: BulkUploadPageProps) {
  const { selectedHousehold, getUserRole } = useHousehold()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const userRole = getUserRole()
  const canEdit = canManageData(userRole)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload')
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [processedData, setProcessedData] = useState<ParsedTransaction[]>([])
  const [clientFailures, setClientFailures] = useState<FailureDetail[]>([])
  const [uploadStats, setUploadStats] = useState<{
    total: number
    successful: number
    failed: number
    failures?: Array<{
      row: number
      transaction: ParsedTransaction
      issues: Array<{ kind: string; fields: string[]; message: string }>
      existingTransaction?: {
        createdAt: string
        account: string
        amount: string
        description: string
        transactionDate: string
      }
    }>
  }>({ total: 0, successful: 0, failed: 0 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<TransactionUser[]>([])
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])
  const [entitiesLoaded, setEntitiesLoaded] = useState(false)

  // Preview validation state
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [dryRunFailures, setDryRunFailures] = useState<FailureDetail[]>([])
  const [dryRunValid, setDryRunValid] = useState<number | null>(null)
  const [previewEditedCount, setPreviewEditedCount] = useState(0)
  const previewEditedRowsRef = useRef<
    Array<{
      failure: FailureDetail
      editedTransactionDate: string
      editedDescription: string
      editedAmount: string
      editedAccount: string
      editedUser: string
      editedCategory: string
      editedType: string
    }>
  >([])

  // Complete-step failure state (for retry grid)
  const [completeFailures, setCompleteFailures] = useState<FailureDetail[]>([])

  const processFile = async (selectedFile: File) => {
    if (isValidCsvFile(selectedFile)) {
      setFile(selectedFile)
      parseCSVFile(selectedFile)
    } else if (isValidExcelFile(selectedFile)) {
      setFile(selectedFile)
      try {
        const rows = await parseExcelToRows(selectedFile)
        if (rows.length === 0) {
          toast.error('The Excel file appears to be empty')
          return
        }
        setRawData(rows)
        autoMapColumns(rows)
        setStep('mapping')
      } catch {
        toast.error('Failed to parse Excel file')
      }
    } else {
      toast.error('Please select a valid CSV or Excel (.xlsx) file')
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0]
      processFile(droppedFile)
    }
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleUploadTriggerKeyDown = (event: React.KeyboardEvent<HTMLLabelElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFilePicker()
  }

  // ── File parsing ──────────────────────────────────────────

  const parseCSVFile = (csvFile: File) => {
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast.error('Error parsing CSV file')
          return
        }

        setRawData(results.data as Record<string, unknown>[])
        autoMapColumns(results.data as Record<string, unknown>[])
        setStep('mapping')
      },
      error: (error) => {
        console.error('CSV parsing error:', error)
        toast.error('Failed to parse CSV file')
      },
    })
  }

  const autoMapColumns = (data: Record<string, unknown>[]) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const mappings: ColumnMapping[] = headers.map((header) => {
      const normalizedHeader = normalizeHeader(header)
      const mappedField = headerMapping[normalizedHeader]
      const sampleData = String(data[0][header] || '')

      let confidence: 'high' | 'medium' | 'low' = 'low'
      if (mappedField) {
        confidence = 'high'
      } else if (
        normalizedHeader.includes('account') ||
        normalizedHeader.includes('user') ||
        normalizedHeader.includes('date') ||
        normalizedHeader.includes('description') ||
        normalizedHeader.includes('amount')
      ) {
        confidence = 'medium'
      }

      return {
        csvHeader: header,
        mappedField: mappedField || 'skip',
        confidence,
        sampleData,
      }
    })

    setColumnMappings(mappings)
  }

  const fetchCategories = useCallback(async () => {
    if (!selectedHousehold) return
    const { data } = await apiFetch<TransactionCategory[]>(
      `/api/categories?householdId=${selectedHousehold.id}`
    )
    if (data) setCategories(data)
  }, [selectedHousehold])

  const fetchTypes = useCallback(async () => {
    if (!selectedHousehold) return
    const { data } = await apiFetch<TransactionType[]>(
      `/api/types?householdId=${selectedHousehold.id}`
    )
    if (data) setTypes(data)
  }, [selectedHousehold])

  const fetchAccounts = useCallback(async () => {
    if (!selectedHousehold) return
    const { data } = await apiFetch<Account[]>(`/api/accounts?householdId=${selectedHousehold.id}`)
    if (data) setAccounts(data)
  }, [selectedHousehold])

  const fetchUsers = useCallback(async () => {
    if (!selectedHousehold) return
    const { data } = await apiFetch<TransactionUser[]>(
      `/api/users?householdId=${selectedHousehold.id}`
    )
    if (data) setUsers(data)
  }, [selectedHousehold])

  const updateColumnMapping = (
    csvHeader: string,
    mappedField: keyof ParsedTransaction | 'skip'
  ) => {
    setColumnMappings((prev) =>
      prev.map((mapping) =>
        mapping.csvHeader === csvHeader ? { ...mapping, mappedField } : mapping
      )
    )
  }

  // Load entities when household is selected
  React.useEffect(() => {
    const loadEntities = async () => {
      if (selectedHousehold) {
        await Promise.all([fetchCategories(), fetchTypes(), fetchAccounts(), fetchUsers()])
        setEntitiesLoaded(true)
      } else {
        setEntitiesLoaded(false)
      }
    }
    loadEntities()
  }, [selectedHousehold, fetchCategories, fetchTypes, fetchAccounts, fetchUsers])

  const validateAndPreviewData = () => {
    const failures: FailureDetail[] = []
    const processed: ParsedTransaction[] = []

    rawData.forEach((row, index) => {
      const transaction: Partial<ParsedTransaction> = {
        rowId: crypto.randomUUID(),
      }

      // Map columns based on user selections
      columnMappings.forEach((mapping) => {
        if (mapping.mappedField !== 'skip') {
          const value = String(row[mapping.csvHeader] || '')

          // Convert date fields from MM/DD/YYYY to ISO format
          if (mapping.mappedField === 'transactionDate' || mapping.mappedField === 'postDate') {
            transaction[mapping.mappedField] = convertFileDateToISO(value)
          } else {
            transaction[mapping.mappedField] = value
          }
        }
      })

      // Default postDate to transactionDate if not provided
      if (!transaction.postDate?.trim() && transaction.transactionDate?.trim()) {
        transaction.postDate = transaction.transactionDate
      }

      // Collect issues for this row
      const rowIssues: FailureIssue[] = []

      if (!transaction.account?.trim()) {
        rowIssues.push({
          kind: 'format',
          fields: ['account'],
          message: 'Account is required',
        })
      }

      if (!transaction.transactionDate?.trim()) {
        rowIssues.push({
          kind: 'format',
          fields: ['transactionDate'],
          message: 'Transaction date is required',
        })
      } else if (
        !transaction.transactionDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(transaction.transactionDate)
      ) {
        rowIssues.push({
          kind: 'format',
          fields: ['transactionDate'],
          message: 'Invalid date format - expected MM/DD/YYYY',
        })
      }

      if (!transaction.description?.trim()) {
        rowIssues.push({
          kind: 'format',
          fields: ['description'],
          message: 'Description is required',
        })
      }

      if (!transaction.amount?.trim()) {
        rowIssues.push({
          kind: 'format',
          fields: ['amount'],
          message: 'Amount is required',
        })
      } else {
        const amount = parseFloat(transaction.amount.replace(/[,$]/g, ''))
        if (isNaN(amount)) {
          rowIssues.push({
            kind: 'format',
            fields: ['amount'],
            message: 'Amount must be a valid number',
          })
        }
      }

      // Validate entity existence (only if entities are loaded)
      if (entitiesLoaded) {
        if (transaction.account?.trim() && !accounts.some((a) => a.name === transaction.account)) {
          rowIssues.push({
            kind: 'entity',
            fields: ['account'],
            message: `Account "${transaction.account}" is not defined`,
          })
        }

        if (transaction.user?.trim() && !users.some((u) => u.name === transaction.user)) {
          rowIssues.push({
            kind: 'entity',
            fields: ['user'],
            message: `User "${transaction.user}" is not defined`,
          })
        }

        if (
          transaction.category?.trim() &&
          !categories.some((c) => c.name === transaction.category)
        ) {
          rowIssues.push({
            kind: 'entity',
            fields: ['category'],
            message: `Category "${transaction.category}" is not defined`,
          })
        }

        if (transaction.type?.trim() && !types.some((t) => t.name === transaction.type)) {
          rowIssues.push({
            kind: 'entity',
            fields: ['type'],
            message: `Type "${transaction.type}" is not defined`,
          })
        }
      }

      if (rowIssues.length > 0) {
        failures.push({
          index: index,
          row: index + 2, // +2 for header row and 0-index
          transaction: {
            account: transaction.account || '',
            user: transaction.user || undefined,
            transactionDate: transaction.transactionDate || '',
            postDate: transaction.postDate || undefined,
            description: transaction.description || '',
            category: transaction.category || '',
            type: transaction.type || '',
            amount: transaction.amount || '',
            memo: transaction.memo || undefined,
            rowId: transaction.rowId,
          },
          issues: rowIssues,
        })
      } else {
        processed.push(transaction as ParsedTransaction)
      }
    })

    setClientFailures(failures)
    setProcessedData(processed)
    setStep('preview')

    // Auto-trigger dry-run if there are valid transactions
    if (processed.length > 0 && selectedHousehold?.id) {
      runDryRun(processed)
    }
  }

  const runDryRun = async (transactions: ParsedTransaction[]) => {
    if (!selectedHousehold?.id) return

    setIsDryRunning(true)
    setDryRunFailures([])
    setDryRunValid(null)
    previewEditedRowsRef.current = []

    const { data } = await apiFetch<{
      success: boolean
      results: {
        total: number
        valid: number
        failed: number
        failures: FailureDetail[]
      }
    }>('/api/transactions/bulk/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions,
        householdId: selectedHousehold.id,
      }),
      showErrorToast: true,
      showRateLimitToast: true,
    })

    if (data?.results) {
      setDryRunFailures(data.results.failures)
      setDryRunValid(data.results.valid)
    }

    setIsDryRunning(false)
  }

  const handlePreviewRowsChange = useCallback(
    (
      rows: Array<{
        failure: FailureDetail
        status: string
        editedTransactionDate: string
        editedDescription: string
        editedAmount: string
        editedAccount: string
        editedUser: string
        editedCategory: string
        editedType: string
      }>
    ) => {
      const edited = rows.filter((r) => r.status !== 'pending')
      previewEditedRowsRef.current = edited.map((r) => ({
        failure: r.failure,
        editedTransactionDate: r.editedTransactionDate,
        editedDescription: r.editedDescription,
        editedAmount: r.editedAmount,
        editedAccount: r.editedAccount,
        editedUser: r.editedUser,
        editedCategory: r.editedCategory,
        editedType: r.editedType,
      }))
      setPreviewEditedCount(edited.length)
    },
    []
  )

  // Build the upload payload by merging valid rows with user-edited dry-run failures
  const buildUploadPayload = (): ParsedTransaction[] => {
    // If no dry-run was performed, use processedData as-is
    if (dryRunFailures.length === 0 && previewEditedRowsRef.current.length === 0) {
      return processedData
    }

    // Start with valid rows (those that passed dry-run, i.e. not in the failure list)
    const failureIndices = new Set(dryRunFailures.map((f) => f.index))
    const validRows = processedData.filter((_, i) => !failureIndices.has(i))

    // Add edited/modified failure rows back
    const editedRows: ParsedTransaction[] = previewEditedRowsRef.current.map((r) => {
      const postDate = r.failure.transaction.postDate?.trim()
        ? r.failure.transaction.postDate
        : r.editedTransactionDate
      return {
        account: r.editedAccount,
        user: r.editedUser,
        transactionDate: r.editedTransactionDate,
        postDate,
        description: r.editedDescription,
        category: r.editedCategory,
        type: r.editedType,
        amount: r.editedAmount,
        memo: r.failure.transaction.memo ?? '',
        rowId: r.failure.transaction.rowId ?? crypto.randomUUID(),
      }
    })

    return [...validRows, ...editedRows]
  }

  const uploadTransactions = async () => {
    setUploading(true)

    // Validate required data before upload
    if (!selectedHousehold?.id) {
      toast.error('No household selected')
      setUploading(false)
      return
    }

    if (
      !processedData ||
      (processedData.length === 0 && previewEditedRowsRef.current.length === 0)
    ) {
      toast.error('No transaction data to upload')
      setUploading(false)
      return
    }

    const { data, error, errorData } = await apiFetch<{
      success: boolean
      message?: string
      results?: {
        total: number
        successful: number
        failed: number
        failures: Array<{
          row: number
          transaction: ParsedTransaction
          issues: Array<{ kind: string; fields: string[]; message: string }>
          existingTransaction?: {
            createdAt: string
            account: string
            amount: string
            description: string
            transactionDate: string
          }
        }>
      }
    }>('/api/transactions/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: buildUploadPayload(),
        householdId: selectedHousehold?.id,
      }),
      showErrorToast: false, // Handle success/error toasts manually
      showRateLimitToast: true, // Show rate limit toasts
    })

    if (data) {
      setUploadStats({
        total: data.results?.total || processedData.length,
        successful: data.results?.successful || 0,
        failed: data.results?.failed || 0,
        failures: data.results?.failures || [],
      })

      // Convert failures to FailureDetail format for the retry grid
      const failures = data.results?.failures || []
      setCompleteFailures(
        failures.map((f, i) => ({
          index: i,
          row: f.row,
          transaction: f.transaction,
          issues: (f.issues || []).map((iss) => ({
            kind: iss.kind as 'format' | 'entity' | 'duplicate',
            fields: iss.fields,
            message: iss.message,
          })),
          existingTransaction: f.existingTransaction,
        }))
      )

      const hasFailures = (data.results?.failed || 0) > 0
      if (hasFailures) {
        toast.success(
          `Upload completed with ${data.results?.failed || 0} failures. ${data.results?.successful || 0} transactions uploaded successfully.`
        )
      } else {
        toast.success(
          data.message ||
            `Successfully uploaded ${data.results?.successful || processedData.length} transactions`
        )
      }

      // Invalidate active month cache to refresh dashboard components
      if (selectedHousehold?.id) {
        invalidateActiveMonthCache(selectedHousehold.id)
      }
      onUploadComplete()
      setStep('complete')
    } else if (error) {
      console.error('Upload error:', error)
      if (errorData) {
        console.error('Error details:', errorData)
      }

      // Only show toast if it's not a rate limit error (already handled by apiFetch)
      if (!error.includes('Rate limit exceeded')) {
        if (error.includes('Validation failed') || error.includes('validation')) {
          // Fallback for generic validation errors
          toast.error('Validation errors found - please check your data')
          setStep('preview')
        } else if (error.includes('Missing entities')) {
          // Entity validation errors
          toast.error(
            'Missing entities - please define required accounts, categories, types, or users first'
          )
          setStep('preview')
        } else {
          // Other errors
          toast.error(`Upload failed: ${error}`)
        }
      }
    }

    setUploading(false)
  }

  const resetUpload = () => {
    setFile(null)
    setStep('upload')
    setRawData([])
    setColumnMappings([])
    setProcessedData([])
    setClientFailures([])
    setUploadStats({ total: 0, successful: 0, failed: 0, failures: [] })
    setIsDragOver(false)
    setIsDryRunning(false)
    setDryRunFailures([])
    setDryRunValid(null)
    setPreviewEditedCount(0)
    previewEditedRowsRef.current = []
    setCompleteFailures([])
  }

  const downloadFailureReport = () => {
    if (!uploadStats.failures || uploadStats.failures.length === 0) return

    // Helper to properly escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return `"${value}"`
    }

    const csvContent = [
      'Row,Issues,Account,Transaction Date,Description,Amount,Created Date',
      ...uploadStats.failures.map((failure) => {
        const t = failure.transaction
        const issuesSummary = (failure.issues || []).map((iss) => iss.message).join('; ')
        return [
          failure.row,
          escapeCSV(issuesSummary),
          escapeCSV(t.account),
          escapeCSV(t.transactionDate),
          escapeCSV(t.description),
          escapeCSV(t.amount),
          escapeCSV(failure.existingTransaction?.createdAt || ''),
        ].join(',')
      }),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `upload-failures-${todayLocal()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Merge client-side and server-side failures for the preview grid, deduplicating by row index
  const mergedPreviewFailures = useMemo(() => {
    const byIndex = new Map<number, FailureDetail>()
    for (const f of clientFailures) {
      byIndex.set(f.index, f)
    }
    for (const f of dryRunFailures) {
      const existing = byIndex.get(f.index)
      if (existing) {
        // Merge issues from both sources
        byIndex.set(f.index, {
          ...existing,
          issues: [...existing.issues, ...f.issues],
        })
      } else {
        byIndex.set(f.index, f)
      }
    }
    return Array.from(byIndex.values()).sort((a, b) => a.index - b.index)
  }, [clientFailures, dryRunFailures])

  if (!selectedHousehold) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Please select a household to upload transactions.
            </p>
          </CardContent>
        </Card>
      </div>
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
                You have view-only access to this household and cannot upload transactions.
              </p>
              <Link href="/dashboard/transactions">
                <Button variant="outline">View Transactions</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {uploading && <LoadingOverlay show={uploading} message="Uploading transactions..." />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Navigation Card */}
        <Link href="/dashboard/transactions/manage">
          <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200 max-w-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Manage Transactions</CardTitle>
                  <CardDescription>View, Add, Edit, and Delete Transactions</CardDescription>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader className="p-6 pb-0">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Upload Transactions
            </CardTitle>
            <CardDescription>
              Select a CSV or Excel file containing transaction data to import
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-4">
            <label
              htmlFor="csv-upload"
              role="button"
              tabIndex={0}
              className={cn(
                'block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-muted-foreground/25 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
              )}
              onKeyDown={handleUploadTriggerKeyDown}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <FileText
                className={cn(
                  'h-8 w-8 mx-auto mb-4',
                  isDragOver ? 'text-blue-500' : 'text-muted-foreground'
                )}
              />
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {isDragOver ? 'Drop file here' : 'Click to select a file or drag and drop'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Supported formats: CSV and Excel (.xlsx)
                </div>
              </div>
            </label>

            {file && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            <Card className="p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Upload Instructions</CardTitle>
                <CardDescription className="pb-2">
                  Your CSV or Excel file should include the following columns. Column names are
                  case-insensitive. The order of the columns does not matter and you can map them
                  after uploading/selecting your file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {/* Account */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Account</span>
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Financial account name (e.g., &quot;Chase Checking&quot;, &quot;Wells Fargo
                        Credit Card&quot;)
                      </p>
                      <p className="text-xs text-muted-foreground">Format: Text</p>
                    </div>
                    <Link
                      href="/dashboard/definitions/accounts"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      Manage Accounts <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Transaction Date */}
                  <div className="flex flex-col gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Transaction Date</span>
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Date when the transaction occurred
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Format: MM/DD/YYYY (e.g., 12/25/2024). Excel Date or General cells are also
                        accepted.
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Description</span>
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Transaction description or merchant name
                      </p>
                      <p className="text-xs text-muted-foreground">Format: Text</p>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Category</span>
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Expense or income category (e.g., &quot;Food &amp; Dining&quot;,
                        &quot;Salary&quot;)
                      </p>
                      <p className="text-xs text-muted-foreground">Format: Text</p>
                    </div>
                    <Link
                      href="/dashboard/definitions/categories"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      Manage Categories <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Type */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Type</span>
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Transaction type (e.g., &quot;Purchase&quot;, &quot;Transfer&quot;,
                        &quot;Payment&quot;)
                      </p>
                      <p className="text-xs text-muted-foreground">Format: Text</p>
                    </div>
                    <Link
                      href="/dashboard/definitions/types"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      Manage Types <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Amount */}
                  <div className="flex flex-col gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Amount</span>
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Transaction amount (positive for income, negative for expenses)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Format: Decimal number (e.g., -25.50, 1250.00). Excel Numeric or General
                        cells are also accepted.
                      </p>
                    </div>
                  </div>

                  {/* User */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">User</span>
                        <Badge variant="secondary" className="text-xs">
                          Optional
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Person who made the transaction (leave empty for household-level)
                      </p>
                      <p className="text-xs text-muted-foreground">Format: Text</p>
                    </div>
                    <Link
                      href="/dashboard/definitions/users"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      Manage Users <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Post Date */}
                  <div className="flex flex-col gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Post Date</span>
                        <Badge variant="secondary" className="text-xs">
                          Optional
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Date when transaction posted to account (defaults to transaction date if not
                        provided)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Format: MM/DD/YYYY (e.g., 12/27/2024). Excel Date or General cells are also
                        accepted.
                      </p>
                    </div>
                  </div>

                  {/* Memo */}
                  <div className="flex flex-col gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Memo</span>
                        <Badge variant="secondary" className="text-xs">
                          Optional
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Additional notes or comments about the transaction
                      </p>
                      <p className="text-xs text-muted-foreground">Format: Text</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {/* Column Mapping Step */}
      {step === 'mapping' && (
        <Card>
          <CardHeader className="p-6 pb-0">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Map Columns
            </CardTitle>
            <CardDescription>
              Map your file&apos;s columns to the required transaction fields
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-4">
            <div className="space-y-3">
              {columnMappings.map((mapping) => (
                <div
                  key={mapping.csvHeader}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{mapping.csvHeader}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      Sample: {mapping.sampleData}
                    </div>
                  </div>
                  <div className="sm:w-48">
                    <Select
                      value={mapping.mappedField}
                      onValueChange={(value) =>
                        updateColumnMapping(
                          mapping.csvHeader,
                          value as keyof ParsedTransaction | 'skip'
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip Column</SelectItem>
                        <SelectItem value="account">Account</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="transactionDate">Transaction Date</SelectItem>
                        <SelectItem value="postDate">Post Date</SelectItem>
                        <SelectItem value="description">Description</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="memo">Memo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        mapping.confidence === 'high'
                          ? 'bg-green-500'
                          : mapping.confidence === 'medium'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="text-xs text-muted-foreground capitalize">
                      {mapping.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={validateAndPreviewData} disabled={!entitiesLoaded}>
                {entitiesLoaded ? (
                  'Continue to Preview'
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading household data…
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Dry-run validation results */}
          {isDryRunning && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking for duplicates and validating entities...
                </div>
              </CardContent>
            </Card>
          )}

          {!isDryRunning && dryRunValid !== null && dryRunFailures.length === 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  All {dryRunValid} transactions passed server validation
                </div>
              </CardContent>
            </Card>
          )}

          {!isDryRunning &&
            (clientFailures.length > 0 || dryRunFailures.length > 0) &&
            selectedHousehold && (
              <Card>
                <CardHeader className="p-6 pb-0">
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Validation Issues ({clientFailures.length + dryRunFailures.length})
                  </CardTitle>
                  <CardDescription>
                    Edit or dismiss these rows before uploading. Modified rows will be included in
                    the upload.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-4">
                  <FailedTransactionsGrid
                    failures={mergedPreviewFailures}
                    householdId={selectedHousehold.id}
                    mode="preview"
                    accounts={accounts}
                    users={users}
                    categories={categories}
                    types={types}
                    onRowsChange={handlePreviewRowsChange}
                  />
                </CardContent>
              </Card>
            )}

          <Card>
            <CardHeader className="p-6 pb-0">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Preview Data
              </CardTitle>
              <CardDescription>
                {processedData.length} valid transactions found out of {rawData.length} total rows
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {processedData.slice(0, 5).map((transaction, index) => (
                  <div key={index} className="text-sm p-2 border rounded">
                    <div className="font-medium">{transaction.description}</div>
                    <div className="text-muted-foreground">
                      {transaction.account} • {transaction.user} •{' '}
                      {transaction.transactionDate
                        ? displayDate(transaction.transactionDate)
                        : 'Invalid Date'}{' '}
                      •{' '}
                      <span
                        className={`${
                          (parseFloat(transaction.amount.replace(/[,$]/g, '')) || 0) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(parseFloat(transaction.amount.replace(/[,$]/g, '')) || 0)}
                      </span>
                    </div>
                  </div>
                ))}
                {processedData.length > 5 && (
                  <div className="text-sm text-muted-foreground text-center">
                    ... and {processedData.length - 5} more transactions
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDryRunFailures([])
                    setDryRunValid(null)
                    setIsDryRunning(false)
                    setPreviewEditedCount(0)
                    previewEditedRowsRef.current = []
                    setStep('mapping')
                  }}
                >
                  Back to Mapping
                </Button>
                <Button
                  onClick={uploadTransactions}
                  disabled={
                    (processedData.length === 0 && previewEditedCount === 0) || isDryRunning
                  }
                >
                  {isDryRunning
                    ? 'Validating...'
                    : `Upload ${(dryRunValid ?? processedData.length) + previewEditedCount} Transactions`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-6 pb-0">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Upload Complete
              </CardTitle>
              <CardDescription>Transaction upload has been completed</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{uploadStats.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{uploadStats.successful}</div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{uploadStats.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>

              {uploadStats.failed > 0 && (
                <div className="space-y-3">
                  <Button variant="outline" onClick={downloadFailureReport} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Get Failure Report
                  </Button>
                </div>
              )}

              <Button onClick={resetUpload} className="w-full">
                Upload Another File
              </Button>
            </CardContent>
          </Card>

          {completeFailures.length > 0 && selectedHousehold && (
            <Card>
              <CardHeader className="p-6 pb-0">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Failed Transactions ({completeFailures.length})
                </CardTitle>
                <CardDescription>
                  Edit and retry failed transactions, or dismiss them
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-4">
                <FailedTransactionsGrid
                  failures={completeFailures}
                  householdId={selectedHousehold.id}
                  mode="complete"
                  accounts={accounts}
                  users={users}
                  categories={categories}
                  types={types}
                  onRetryComplete={(results) => {
                    if (results.succeeded > 0) {
                      setUploadStats((prev) => ({
                        ...prev,
                        successful: prev.successful + results.succeeded,
                        failed: prev.failed - results.succeeded,
                      }))
                      invalidateActiveMonthCache(selectedHousehold.id)
                      onUploadComplete()
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
