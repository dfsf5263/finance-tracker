'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'

interface CSVUploadProps {
  open: boolean
  onClose: () => void
  onUploadComplete: () => void
}

interface CSVTransaction {
  source: string
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

// Normalize header names to handle case and space variations
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, '')
}

// Map normalized headers to expected field names
const headerMapping: Record<string, keyof CSVTransaction> = {
  source: 'source',
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
const requiredHeaders = ['source', 'user', 'transactiondate', 'description', 'amount']

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      setValidationErrors([])

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Check if CSV has required headers
          if (results.meta.fields) {
            const normalizedFields = results.meta.fields.map((f) => normalizeHeader(f))
            const missingHeaders = requiredHeaders.filter(
              (h) => !normalizedFields.some((f) => f === h)
            )

            if (missingHeaders.length > 0) {
              const missingHeaderNames = missingHeaders.map((h) => {
                // Convert back to readable format
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
              return
            }
          }

          // Normalize the data
          const normalizedData = results.data
            .map((row) => normalizeRow(row as Record<string, unknown>))
            .filter((row): row is CSVTransaction => row !== null)

          setPreview(normalizedData.slice(0, 3))
        },
        error: (error) => {
          toast.error(`Error parsing CSV: ${error.message}`)
        },
      })
    } else {
      toast.error('Please select a valid CSV file')
    }
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
            source: t.source.trim(),
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

  const handleClose = () => {
    setFile(null)
    setPreview([])
    setValidationErrors([])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload CSV Transactions</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <Label htmlFor="csv-file" className="cursor-pointer">
              <span className="text-sm text-muted-foreground">
                Click to upload CSV file or drag and drop
              </span>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </Label>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Preview (first 3 rows):</h3>
              <div className="border border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left text-foreground">Source</th>
                      <th className="p-2 text-left text-foreground">User</th>
                      <th className="p-2 text-left text-foreground">Date</th>
                      <th className="p-2 text-left text-foreground">Description</th>
                      <th className="p-2 text-left text-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((transaction, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="p-2 text-foreground">{transaction.source}</td>
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
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

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file || uploading} className="min-w-[100px]">
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
      <LoadingOverlay show={uploading} message="Uploading transactions..." />
    </Dialog>
  )
}
