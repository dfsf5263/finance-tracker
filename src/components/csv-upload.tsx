'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Upload, FileText, AlertCircle, Download } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'

interface CSVUploadProps {
  open: boolean
  onClose: () => void
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

// Required headers (normalized)
const requiredHeaders = ['account', 'user', 'transactiondate', 'description', 'amount']

// Convert raw CSV row to CSVTransaction with normalized headers
function normalizeRow(row: Record<string, unknown>): CSVTransaction | null {
  const normalized: Partial<CSVTransaction> = {}

  for (const [rawHeader, value] of Object.entries(row)) {
    const normalizedHeader = normalizeHeader(rawHeader)
    const mappedField = headerMapping[normalizedHeader]

    if (mappedField) {
      normalized[mappedField] = value as string
    }
  }

  // Check if we have all required fields
  const hasAllRequired = requiredHeaders.every((header) => {
    const field = headerMapping[header]
    return field && normalized[field]
  })

  if (!hasAllRequired) {
    return null
  }

  return normalized as CSVTransaction
}

export function CSVUpload({ open, onClose, onUploadComplete }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<CSVTransaction[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [showMapping, setShowMapping] = useState(false)
  const [rawCsvData, setRawCsvData] = useState<Record<string, unknown>[]>([])

  // Auto-mapping logic with common header variations
  const autoMapHeaders = (csvHeaders: string[]): ColumnMapping[] => {
    const headerVariations: Record<keyof CSVTransaction, string[]> = {
      account: ['account', 'bank', 'institution', 'financial institution', 'account'],
      user: ['user', 'account holder', 'name', 'customer', 'client'],
      transactionDate: ['transaction date', 'trans date', 'date', 'transaction_date', 'transdate'],
      postDate: ['post date', 'posting date', 'posted date', 'post_date', 'postdate'],
      description: ['description', 'desc', 'transaction', 'details'],
      category: ['category', 'cat', 'classification', 'group'],
      type: ['type', 'transaction type', 'trans type', 'debit/credit', 'dr/cr'],
      amount: ['amount', 'amt', 'value', 'total', 'sum', 'dollar amount', 'money'],
      memo: ['memo', 'note', 'notes', 'comment', 'remarks', 'additional info', 'info'],
    }

    return csvHeaders.map((header) => {
      const normalizedHeader = normalizeHeader(header)
      let bestMatch: keyof CSVTransaction | 'skip' = 'skip'
      let confidence: 'high' | 'medium' | 'low' = 'low'

      // Check for exact matches first
      for (const [field, variations] of Object.entries(headerVariations)) {
        if (variations.some((variation) => normalizeHeader(variation) === normalizedHeader)) {
          bestMatch = field as keyof CSVTransaction
          confidence = 'high'
          break
        }
      }

      // Check for partial matches if no exact match found
      if (bestMatch === 'skip') {
        for (const [field, variations] of Object.entries(headerVariations)) {
          if (
            variations.some(
              (variation) =>
                normalizedHeader.includes(normalizeHeader(variation)) ||
                normalizeHeader(variation).includes(normalizedHeader)
            )
          ) {
            bestMatch = field as keyof CSVTransaction
            confidence = 'medium'
            break
          }
        }
      }

      return {
        csvHeader: header,
        mappedField: bestMatch,
        confidence,
        sampleData: '',
      }
    })
  }

  const processFile = (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      setValidationErrors([])

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            // Store raw CSV data
            setRawCsvData(results.data as Record<string, unknown>[])

            // Auto-map headers and add sample data
            const mappings = autoMapHeaders(results.meta.fields).map((mapping) => ({
              ...mapping,
              sampleData:
                results.data.length > 0
                  ? String((results.data[0] as Record<string, unknown>)[mapping.csvHeader] || '')
                  : '',
            }))

            setColumnMappings(mappings)
            setShowMapping(true)
          }
        },
        error: (error) => {
          toast.error(`Error parsing CSV: ${error.message}`)
        },
      })
    } else {
      toast.error('Please select a valid CSV file')
    }
  }

  // Helper function to validate date format (MM/DD/YYYY)
  const isValidDateFormat = (dateString: string): boolean => {
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/
    if (!dateRegex.test(dateString)) return false

    // Check if the date is actually valid
    const [month, day, year] = dateString.split('/').map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
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
    const fileInput = document.getElementById('csv-file') as HTMLInputElement
    fileInput?.click()
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setValidationErrors([])

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          // Validate headers first
          if (results.meta.fields) {
            const normalizedFields = results.meta.fields.map((f) => normalizeHeader(f))
            const missingHeaders = requiredHeaders.filter(
              (h) => !normalizedFields.some((f) => f === h)
            )

            if (missingHeaders.length > 0) {
              const missingHeaderNames = missingHeaders.map((h) => {
                switch (h) {
                  case 'transactiondate':
                    return 'Transaction Date'
                  case 'postdate':
                    return 'Post Date'
                  default:
                    return h.charAt(0).toUpperCase() + h.slice(1)
                }
              })
              toast.error(`Missing required headers: ${missingHeaderNames.join(', ')}`)
              setUploading(false)
              return
            }
          }

          // Normalize all rows
          const normalizedTransactions = results.data
            .map((row) => normalizeRow(row as Record<string, unknown>))
            .filter((row): row is CSVTransaction => row !== null)

          // Format transactions for API
          const formattedTransactions = normalizedTransactions.map((t) => ({
            account: t.account.trim(),
            user: t.user.trim(),
            transactionDate: t.transactionDate,
            postDate: t.postDate || t.transactionDate,
            description: t.description.trim(),
            category: t.category?.trim() || 'Other',
            type: t.type?.trim() || 'Debit',
            amount: t.amount,
            memo: t.memo?.trim() || '',
          }))

          if (formattedTransactions.length === 0) {
            toast.error('No valid transactions found in the CSV file')
            setUploading(false)
            return
          }

          const response = await fetch('/api/transactions/bulk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ transactions: formattedTransactions }),
          })

          const result = await response.json()

          if (response.ok) {
            toast.success(result.message)
            onUploadComplete()
            handleClose()
          } else {
            if (result.validationErrors) {
              setValidationErrors(result.validationErrors)
              toast.error(result.message)
            } else {
              toast.error(result.error || 'Failed to upload transactions')
            }
          }
        },
        error: (error) => {
          toast.error(`Error parsing CSV: ${error.message}`)
        },
      })
    } catch (error) {
      toast.error('Failed to upload transactions')
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = () => {
    // Create CSV template with headers and sample data
    const templateContent = `Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo
Chase Bank,Chris,01/15/2024,01/17/2024,Grocery Store Purchase,Food & Dining,Debit,125.50,Weekly shopping
Wells Fargo,Jane,02/20/2024,02/22/2024,Gas Station,Transportation,Debit,45.75,Fuel for car
Chase Bank,Bob,03/10/2024,03/12/2024,Restaurant Bill,Food & Dining,Debit,85.25,Dinner out`

    // Create blob and download
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', 'transaction-template.csv')
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
    toast.success('Template downloaded successfully!')
  }

  const updateMapping = (csvHeader: string, newMapping: keyof CSVTransaction | 'skip') => {
    setColumnMappings((prev) =>
      prev.map((mapping) =>
        mapping.csvHeader === csvHeader ? { ...mapping, mappedField: newMapping } : mapping
      )
    )
  }

  const resetMappings = () => {
    if (file && rawCsvData.length > 0) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            const mappings = autoMapHeaders(results.meta.fields).map((mapping) => ({
              ...mapping,
              sampleData:
                results.data.length > 0
                  ? String((results.data[0] as Record<string, unknown>)[mapping.csvHeader] || '')
                  : '',
            }))
            setColumnMappings(mappings)
          }
        },
      })
    }
  }

  const proceedToPreview = () => {
    // Process data using column mappings
    const mappedData = rawCsvData
      .map((row) => {
        const mappedRow: Partial<CSVTransaction> = {}

        columnMappings.forEach((mapping) => {
          if (mapping.mappedField !== 'skip') {
            mappedRow[mapping.mappedField] = row[mapping.csvHeader] as string
          }
        })

        return mappedRow as CSVTransaction
      })
      .filter(
        (row) =>
          // Only include rows that have the essential required fields
          row.description && row.amount
      )

    // Validate the mapped data
    const clientValidationErrors: ValidationError[] = []

    mappedData.forEach((transaction, index) => {
      const rowNumber = index + 2

      if (!transaction.account?.trim()) {
        clientValidationErrors.push({
          row: rowNumber,
          field: 'account',
          value: transaction.account || '',
          message: 'Account is required',
        })
      }

      if (!transaction.user?.trim()) {
        clientValidationErrors.push({
          row: rowNumber,
          field: 'user',
          value: transaction.user || '',
          message: 'User is required',
        })
      }

      if (!transaction.description?.trim()) {
        clientValidationErrors.push({
          row: rowNumber,
          field: 'description',
          value: transaction.description || '',
          message: 'Description is required',
        })
      }

      if (!transaction.amount?.trim()) {
        clientValidationErrors.push({
          row: rowNumber,
          field: 'amount',
          value: transaction.amount || '',
          message: 'Amount is required',
        })
      } else {
        const amount = parseFloat(transaction.amount)
        if (isNaN(amount)) {
          clientValidationErrors.push({
            row: rowNumber,
            field: 'amount',
            value: transaction.amount,
            message: 'Amount must be a valid number',
          })
        }
      }

      if (transaction.transactionDate && !isValidDateFormat(transaction.transactionDate)) {
        clientValidationErrors.push({
          row: rowNumber,
          field: 'transactionDate',
          value: transaction.transactionDate,
          message: 'Transaction Date must be in MM/DD/YYYY format',
        })
      }
    })

    setValidationErrors(clientValidationErrors)
    setPreview(mappedData.slice(0, 3))
    setShowMapping(false)

    if (clientValidationErrors.length > 0) {
      toast.error(
        `Found ${clientValidationErrors.length} validation error${clientValidationErrors.length > 1 ? 's' : ''} in CSV file`
      )
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreview([])
    setValidationErrors([])
    setIsDragOver(false)
    setColumnMappings([])
    setShowMapping(false)
    setRawCsvData([])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload CSV Transactions</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Need help getting started?</div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'border-border hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadAreaClick}
          >
            <Upload
              className={`mx-auto h-12 w-12 mb-4 ${
                isDragOver ? 'text-blue-500' : 'text-muted-foreground'
              }`}
            />
            <div className="text-sm text-muted-foreground">
              {isDragOver ? 'Drop CSV file here' : 'Click to upload CSV file or drag and drop'}
            </div>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {file && (
            <div
              className={`flex items-center gap-2 p-3 rounded-xl border ${
                validationErrors.length > 0
                  ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                  : 'bg-muted border-border'
              }`}
            >
              {validationErrors.length > 0 ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <FileText className="h-5 w-5 text-blue-500" />
              )}
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
              {validationErrors.length > 0 && (
                <span className="text-xs text-red-600 font-medium">• Has validation errors</span>
              )}
            </div>
          )}

          {showMapping && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Map CSV Columns</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetMappings}>
                    Auto-Map
                  </Button>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left text-foreground">CSV Column</th>
                      <th className="p-3 text-left text-foreground">Sample Data</th>
                      <th className="p-3 text-left text-foreground">Map To</th>
                      <th className="p-3 text-left text-foreground">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnMappings.map((mapping, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="p-3 text-foreground font-medium">{mapping.csvHeader}</td>
                        <td className="p-3 text-muted-foreground text-xs max-w-32 truncate">
                          {mapping.sampleData}
                        </td>
                        <td className="p-3">
                          <Select
                            value={mapping.mappedField}
                            onValueChange={(value) =>
                              updateMapping(
                                mapping.csvHeader,
                                value as keyof CSVTransaction | 'skip'
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select field..." />
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
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              mapping.confidence === 'high'
                                ? 'bg-green-100 text-green-700'
                                : mapping.confidence === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {mapping.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button onClick={proceedToPreview}>Continue to Preview</Button>
              </div>
            </div>
          )}

          {preview.length > 0 && !showMapping && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Preview (first 3 rows):</h3>
              <div className="border border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left text-foreground">Account</th>
                      <th className="p-2 text-left text-foreground">User</th>
                      <th className="p-2 text-left text-foreground">Date</th>
                      <th className="p-2 text-left text-foreground">Description</th>
                      <th className="p-2 text-left text-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((transaction, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="p-2 text-foreground">{transaction.account}</td>
                        <td className="p-2 text-foreground">{transaction.user}</td>
                        <td className="p-2 text-foreground">{transaction.transactionDate}</td>
                        <td className="p-2 text-foreground">{transaction.description}</td>
                        <td className="p-2 text-foreground">${transaction.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <h4 className="font-medium">Validation Errors</h4>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validationErrors.map((error, index) => (
                  <p key={index} className="text-sm text-red-600">
                    Row {error.row}: {error.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {!showMapping && (
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || validationErrors.length > 0 || preview.length === 0}
                className="min-w-[120px]"
              >
                {uploading
                  ? 'Uploading...'
                  : validationErrors.length > 0
                    ? 'Fix Errors to Upload'
                    : 'Upload'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
      <LoadingOverlay show={uploading} message="Uploading transactions..." />
    </Dialog>
  )
}
