'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Upload, FileText, AlertCircle, Download, CheckCircle, ArrowRight } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import {
  formatCurrency,
  formatDate,
  parseMonthDayYearDate,
  isValidMonthDayYearDate,
} from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'
import { invalidateActiveMonthCache } from '@/hooks/use-active-month'

interface CSVUploadPageProps {
  onUploadComplete: () => void
}

interface CSVTransaction {
  account: string
  user: string
  transactionDate: string
  postDate: string
  description: string
  category: string
  type: string
  amount: string
  memo?: string
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

interface ValidationError {
  row: number
  field: string
  value: string
  message: string
}

interface ColumnMapping {
  csvHeader: string
  mappedField: keyof CSVTransaction | 'skip'
  confidence: 'high' | 'medium' | 'low'
  sampleData: string
}

// Normalize header names to handle case and space variations
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, '')
}

// Map normalized headers to expected field names
const headerMapping: Record<string, keyof CSVTransaction> = {
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

export function CSVUploadPage({ onUploadComplete }: CSVUploadPageProps) {
  const { selectedHousehold } = useHousehold()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload')
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [processedData, setProcessedData] = useState<CSVTransaction[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [uploadStats, setUploadStats] = useState<{
    total: number
    successful: number
    failed: number
  }>({ total: 0, successful: 0, failed: 0 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<TransactionUser[]>([])
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])
  const [entitiesLoaded, setEntitiesLoaded] = useState(false)

  const processFile = (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      parseCSV(selectedFile)
    } else {
      toast.error('Please select a valid CSV file')
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

  const handleUploadAreaClick = () => {
    const fileInput = document.getElementById('csv-upload') as HTMLInputElement
    fileInput?.click()
  }

  const parseCSV = (csvFile: File) => {
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

  const updateColumnMapping = (csvHeader: string, mappedField: keyof CSVTransaction | 'skip') => {
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
    const errors: ValidationError[] = []
    const processed: CSVTransaction[] = []

    rawData.forEach((row, index) => {
      const transaction: Partial<CSVTransaction> = {}

      // Map columns based on user selections
      columnMappings.forEach((mapping) => {
        if (mapping.mappedField !== 'skip') {
          transaction[mapping.mappedField] = String(row[mapping.csvHeader] || '')
        }
      })

      // Validate required fields
      const rowErrors: ValidationError[] = []

      if (!transaction.account?.trim()) {
        rowErrors.push({
          row: index + 1,
          field: 'account',
          value: transaction.account || '',
          message: 'Account is required',
        })
      }

      if (!transaction.transactionDate?.trim()) {
        rowErrors.push({
          row: index + 1,
          field: 'transactionDate',
          value: transaction.transactionDate || '',
          message: 'Transaction date is required',
        })
      } else {
        // Validate date format
        if (!isValidMonthDayYearDate(transaction.transactionDate)) {
          rowErrors.push({
            row: index + 1,
            field: 'transactionDate',
            value: transaction.transactionDate,
            message: 'Invalid date format',
          })
        }
      }

      if (!transaction.description?.trim()) {
        rowErrors.push({
          row: index + 1,
          field: 'description',
          value: transaction.description || '',
          message: 'Description is required',
        })
      }

      if (!transaction.amount?.trim()) {
        rowErrors.push({
          row: index + 1,
          field: 'amount',
          value: transaction.amount || '',
          message: 'Amount is required',
        })
      } else {
        // Validate amount is a number
        const amount = parseFloat(transaction.amount.replace(/[,$]/g, ''))
        if (isNaN(amount)) {
          rowErrors.push({
            row: index + 1,
            field: 'amount',
            value: transaction.amount,
            message: 'Amount must be a valid number',
          })
        }
      }

      // Validate entity existence (only if entities are loaded)
      if (entitiesLoaded) {
        if (transaction.account?.trim() && !accounts.some((a) => a.name === transaction.account)) {
          rowErrors.push({
            row: index + 1,
            field: 'account',
            value: transaction.account,
            message: `Account "${transaction.account}" is not defined. Either correct the account in your upload or add the new account on the definitions page prior to uploading your transactions.`,
          })
        }

        if (transaction.user?.trim() && !users.some((u) => u.name === transaction.user)) {
          rowErrors.push({
            row: index + 1,
            field: 'user',
            value: transaction.user,
            message: `User "${transaction.user}" is not defined. Either correct the user in your upload or add the new user on the definitions page prior to uploading your transactions.`,
          })
        }

        if (
          transaction.category?.trim() &&
          !categories.some((c) => c.name === transaction.category)
        ) {
          rowErrors.push({
            row: index + 1,
            field: 'category',
            value: transaction.category,
            message: `Category "${transaction.category}" is not defined. Either correct the category in your upload or add the new category on the definitions page prior to uploading your transactions.`,
          })
        }

        if (transaction.type?.trim() && !types.some((t) => t.name === transaction.type)) {
          rowErrors.push({
            row: index + 1,
            field: 'type',
            value: transaction.type,
            message: `Type "${transaction.type}" is not defined. Either correct the transaction type in your upload or add the new type on the definitions page prior to uploading your transactions.`,
          })
        }
      }

      errors.push(...rowErrors)

      if (rowErrors.length === 0) {
        processed.push(transaction as CSVTransaction)
      }
    })

    setValidationErrors(errors)
    setProcessedData(processed)
    setStep('preview')
  }

  const uploadTransactions = async () => {
    setUploading(true)

    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: processedData,
          householdId: selectedHousehold?.id,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setUploadStats({
          total: processedData.length,
          successful: result.count || processedData.length,
          failed: 0,
        })
        toast.success(
          result.message || `Successfully uploaded ${processedData.length} transactions`
        )
        // Invalidate active month cache to refresh dashboard components
        if (selectedHousehold?.id) {
          invalidateActiveMonthCache(selectedHousehold.id)
        }
        onUploadComplete()
        setStep('complete')
      } else {
        if (result.validationErrors) {
          setValidationErrors(result.validationErrors)
          toast.error(result.message || 'Validation errors found')
          setStep('preview')
        } else {
          toast.error(result.error || 'Failed to upload transactions')
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload transactions')
    } finally {
      setUploading(false)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setStep('upload')
    setRawData([])
    setColumnMappings([])
    setProcessedData([])
    setValidationErrors([])
    setUploadStats({ total: 0, successful: 0, failed: 0 })
    setIsDragOver(false)
  }

  const downloadErrorReport = () => {
    // Helper to properly escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return `"${value}"`
    }

    const csvContent = [
      'Row,Field,Value,Error',
      ...validationErrors.map(
        (error) =>
          `${error.row},${escapeCSV(error.field)},${escapeCSV(error.value)},${escapeCSV(error.message)}`
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'validation-errors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

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
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select a CSV file containing transaction data to import
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-muted-foreground/25 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleUploadAreaClick}
            >
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <FileText
                className={`h-8 w-8 mx-auto mb-4 ${
                  isDragOver ? 'text-blue-500' : 'text-muted-foreground'
                }`}
              />
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {isDragOver ? 'Drop CSV file here' : 'Click to select CSV file or drag and drop'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Supported format: CSV files only
                </div>
              </div>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Required Columns</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• Account - Financial account name</div>
                <div>• Transaction Date - Date of the transaction</div>
                <div>• Description - Transaction description</div>
                <div>• Category - Expense/income category</div>
                <div>• Type - Transaction type</div>
                <div>• Amount - Transaction amount</div>
              </div>
              <h4 className="text-sm font-medium">Optional Columns</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• User - Person who made the transaction</div>
                <div>• Post Date - When transaction posted</div>
                <div>• Memo - Additional notes</div>
              </div>
            </div>
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
              Map your CSV columns to the required transaction fields
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
                          value as keyof CSVTransaction | 'skip'
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={validateAndPreviewData}>Continue to Preview</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="space-y-4">
          {validationErrors.length > 0 && (
            <Card>
              <CardHeader className="p-6 pb-0">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Validation Errors ({validationErrors.length})
                </CardTitle>
                <CardDescription>
                  The following errors must be fixed before proceeding
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-4">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {validationErrors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-sm p-2 bg-destructive/10 rounded">
                      Row {error.row}: {error.message} (Field: {error.field}, Value: &quot;
                      {error.value}&quot;)
                    </div>
                  ))}
                  {validationErrors.length > 10 && (
                    <div className="text-sm text-muted-foreground">
                      ... and {validationErrors.length - 10} more errors
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <Button variant="outline" onClick={downloadErrorReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Error Report
                  </Button>
                </div>
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
                      {formatDate(parseMonthDayYearDate(transaction.transactionDate))} •{' '}
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
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  Back to Mapping
                </Button>
                <Button
                  onClick={uploadTransactions}
                  disabled={processedData.length === 0 || validationErrors.length > 0}
                >
                  {validationErrors.length > 0
                    ? 'Fix Errors to Upload'
                    : `Upload ${processedData.length} Transactions`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
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

            <Button onClick={resetUpload} className="w-full">
              Upload Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
