'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomDatePicker } from '@/components/ui/date-picker'
import { AlertCircle, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { isoToMDY } from '@/lib/date-utils'
import { useHousehold } from '@/contexts/household-context'
import { apiFetch } from '@/lib/http-utils'
import { sanitizeCellValue } from '@/lib/file-utils'
import type ExcelJS from 'exceljs'

// ── Types ───────────────────────────────────────────────────

type ExportFormat = 'csv' | 'excel'

interface HouseholdEntity {
  id: string
  name: string
  householdId: string
}

interface TransactionResponse {
  id: string
  description: string
  amount: number | string
  memo: string | null
  transactionDate: string
  postDate: string | null
  account: { name: string } | null
  user: { name: string } | null
  category: { name: string } | null
  type: { name: string } | null
}

interface PaginatedResponse {
  transactions: TransactionResponse[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

// ── Constants ───────────────────────────────────────────────

const LARGE_EXPORT_THRESHOLD = 10_000
const PAGE_SIZE = 1000

const COLUMNS = [
  { header: 'Account', key: 'account', width: 20 },
  { header: 'User', key: 'user', width: 20 },
  { header: 'Transaction Date', key: 'transactionDate', width: 18 },
  { header: 'Post Date', key: 'postDate', width: 18 },
  { header: 'Description', key: 'description', width: 40 },
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Type', key: 'type', width: 20 },
  { header: 'Amount', key: 'amount', width: 14 },
  { header: 'Memo', key: 'memo', width: 30 },
]

// ── CSV generation ──────────────────────────────────────────

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function generateCSV(transactions: TransactionResponse[]): Blob {
  const header = 'Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo'
  const rows = transactions.map((t) => {
    const fields = [
      escapeCSVField(t.account?.name ?? ''),
      escapeCSVField(t.user?.name ?? ''),
      isoToMDY(t.transactionDate),
      t.postDate ? isoToMDY(t.postDate) : '',
      escapeCSVField(t.description ?? ''),
      escapeCSVField(t.category?.name ?? ''),
      escapeCSVField(t.type?.name ?? ''),
      String(t.amount),
      escapeCSVField(t.memo ?? ''),
    ]
    return fields.join(',')
  })

  return new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
}

// ── Excel generation ────────────────────────────────────────

async function generateExcel(
  transactions: TransactionResponse[],
  accounts: HouseholdEntity[],
  users: HouseholdEntity[],
  categories: HouseholdEntity[],
  types: HouseholdEntity[]
): Promise<Blob> {
  const ExcelJS = await import('exceljs').then((m) => m.default ?? m)

  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  }
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
  }

  function buildListValidation(
    names: string[],
    ws: ExcelJS.Worksheet,
    listsSheet: ExcelJS.Worksheet,
    colIndex: number,
    rowCount: number,
    listColLetter: string
  ): void {
    if (names.length === 0) return
    names.forEach((name, i) => {
      listsSheet.getCell(`${listColLetter}${i + 1}`).value = sanitizeCellValue(name)
    })
    const rangeRef = `'_Lists'!$${listColLetter}$1:$${listColLetter}$${names.length}`
    for (let r = 2; r <= rowCount + 1; r++) {
      ws.getCell(r, colIndex).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [rangeRef],
        showErrorMessage: true,
        errorTitle: 'Invalid value',
        error: 'Please select a value from the dropdown list.',
      }
    }
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Finance Tracker'
  wb.created = new Date()

  const ws = wb.addWorksheet('Transactions')
  ws.columns = COLUMNS

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = headerFill
    cell.font = headerFont
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  headerRow.height = 22

  // Set number formats
  for (const col of ['A', 'B', 'E', 'F', 'G', 'I']) {
    ws.getColumn(col).numFmt = '@'
  }
  ws.getColumn('C').numFmt = 'mm/dd/yyyy'
  ws.getColumn('D').numFmt = 'mm/dd/yyyy'
  ws.getColumn('H').numFmt = '#,##0.00'

  // Add data rows
  for (const t of transactions) {
    ws.addRow({
      account: sanitizeCellValue(t.account?.name ?? ''),
      user: sanitizeCellValue(t.user?.name ?? ''),
      transactionDate: isoToMDY(t.transactionDate),
      postDate: t.postDate ? isoToMDY(t.postDate) : '',
      description: sanitizeCellValue(t.description ?? ''),
      category: sanitizeCellValue(t.category?.name ?? ''),
      type: sanitizeCellValue(t.type?.name ?? ''),
      amount: Number(t.amount),
      memo: sanitizeCellValue(t.memo ?? ''),
    })
  }

  // Hidden sheet for dropdown list values
  const listsSheet = wb.addWorksheet('_Lists', { state: 'veryHidden' })

  const accountNames = accounts.map((a) => a.name)
  const userNames = users.map((u) => u.name)
  const categoryNames = categories.map((c) => c.name)
  const typeNames = types.map((t) => t.name)

  buildListValidation(accountNames, ws, listsSheet, 1, transactions.length, 'A')
  buildListValidation(userNames, ws, listsSheet, 2, transactions.length, 'B')
  buildListValidation(categoryNames, ws, listsSheet, 6, transactions.length, 'C')
  buildListValidation(typeNames, ws, listsSheet, 7, transactions.length, 'D')

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ── Component ───────────────────────────────────────────────

export function ExportPage() {
  const { selectedHousehold } = useHousehold()

  const [format, setFormat] = useState<ExportFormat | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null)

  // Transaction count preview
  const [transactionCount, setTransactionCount] = useState<number | null>(null)
  const [isCountLoading, setIsCountLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Entities for Excel dropdowns
  const [accounts, setAccounts] = useState<HouseholdEntity[]>([])
  const [users, setUsers] = useState<HouseholdEntity[]>([])
  const [categories, setCategories] = useState<HouseholdEntity[]>([])
  const [types, setTypes] = useState<HouseholdEntity[]>([])

  const dateRangeInvalid = startDate !== '' && endDate !== '' && startDate > endDate

  // ── Entity fetching ─────────────────────────────────────────

  const fetchEntities = useCallback(
    async (endpoint: string): Promise<HouseholdEntity[]> => {
      if (!selectedHousehold) return []
      const { data } = await apiFetch<HouseholdEntity[]>(
        `/api/${endpoint}?householdId=${selectedHousehold.id}`,
        { showErrorToast: false }
      )
      return data ?? []
    },
    [selectedHousehold]
  )

  useEffect(() => {
    const load = async () => {
      if (!selectedHousehold) {
        setAccounts([])
        setUsers([])
        setCategories([])
        setTypes([])
        return
      }
      const [a, u, c, t] = await Promise.all([
        fetchEntities('accounts'),
        fetchEntities('users'),
        fetchEntities('categories'),
        fetchEntities('types'),
      ])
      setAccounts(a)
      setUsers(u)
      setCategories(c)
      setTypes(t)
    }
    load()
  }, [selectedHousehold, fetchEntities])

  // ── Transaction count preview ───────────────────────────────

  useEffect(() => {
    // Reset count when dates change
    setTransactionCount(null)

    if (!selectedHousehold || !startDate || !endDate || startDate > endDate) {
      return
    }

    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsCountLoading(true)

    apiFetch<PaginatedResponse>(
      `/api/transactions?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&limit=1&page=1`,
      { signal: controller.signal, showErrorToast: false }
    )
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setTransactionCount(data?.pagination.total ?? 0)
          setIsCountLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsCountLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [selectedHousehold, startDate, endDate])

  // ── Fetch all transactions (paginated) ──────────────────────

  const fetchAllTransactions = async (): Promise<TransactionResponse[]> => {
    if (!selectedHousehold) return []

    const allTransactions: TransactionResponse[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const { data, error } = await apiFetch<PaginatedResponse>(
        `/api/transactions?householdId=${selectedHousehold.id}&startDate=${startDate}&endDate=${endDate}&limit=${PAGE_SIZE}&page=${page}`
      )

      if (error || !data) {
        throw new Error(error ?? 'Failed to fetch transactions')
      }

      allTransactions.push(...data.transactions)
      totalPages = data.pagination.pages
      setProgress({ fetched: allTransactions.length, total: data.pagination.total })
      page++
    }

    return allTransactions
  }

  // ── Export handler ──────────────────────────────────────────

  const handleExport = async () => {
    if (!format || !startDate || !endDate || !selectedHousehold) return

    setIsExporting(true)
    setProgress(null)

    try {
      const transactions = await fetchAllTransactions()

      if (transactions.length === 0) {
        toast.error('No transactions found for the selected date range')
        return
      }

      let blob: Blob
      let extension: string

      if (format === 'csv') {
        blob = generateCSV(transactions)
        extension = 'csv'
      } else {
        blob = await generateExcel(transactions, accounts, users, categories, types)
        extension = 'xlsx'
      }

      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-export-${startDate}-to-${endDate}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${transactions.length} transactions`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export transactions. Please try again.')
    } finally {
      setIsExporting(false)
      setProgress(null)
    }
  }

  // ── Derived state ───────────────────────────────────────────

  const formComplete = format !== null && startDate !== '' && endDate !== ''
  const canExport =
    formComplete && !dateRangeInvalid && transactionCount !== null && transactionCount > 0
  const exportDisabled = !canExport || isExporting || !selectedHousehold

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {!selectedHousehold && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Select a household to export transactions.</span>
        </div>
      )}

      <Card>
        <CardHeader className="p-6 pb-0">
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Export Transactions
          </CardTitle>
          <CardDescription>
            Download your transaction data as CSV or Excel. The exported file matches the bulk
            upload format for easy re-import.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-4 space-y-4">
          {/* Format select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">File Format</label>
            <Select value={format ?? ''} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date pickers */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <CustomDatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Pick start date"
                disabled={!selectedHousehold}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <CustomDatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="Pick end date"
                disabled={!selectedHousehold}
              />
            </div>
          </div>

          {/* Transaction count / warnings */}
          {dateRangeInvalid && (
            <p className="text-sm text-destructive" role="alert">
              Start date must be before end date
            </p>
          )}

          {!dateRangeInvalid && isCountLoading && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking transaction count…
            </p>
          )}

          {!dateRangeInvalid && !isCountLoading && transactionCount === 0 && (
            <p className="text-sm text-destructive" role="alert">
              No transactions found for the selected date range
            </p>
          )}

          {!dateRangeInvalid &&
            !isCountLoading &&
            transactionCount !== null &&
            transactionCount > 0 &&
            transactionCount <= LARGE_EXPORT_THRESHOLD && (
              <p className="text-sm text-muted-foreground">
                {transactionCount.toLocaleString()} transactions
              </p>
            )}

          {!dateRangeInvalid &&
            !isCountLoading &&
            transactionCount !== null &&
            transactionCount > LARGE_EXPORT_THRESHOLD && (
              <p className="text-sm text-yellow-700 dark:text-yellow-300" role="alert">
                This export contains {transactionCount.toLocaleString()} transactions and may take a
                moment to generate
              </p>
            )}

          {/* Progress indicator */}
          {isExporting && progress && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Fetching transactions… {progress.fetched.toLocaleString()} /{' '}
                {progress.total.toLocaleString()}
              </p>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.round((progress.fetched / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Export button */}
          <Button onClick={handleExport} disabled={exportDisabled} className="w-full sm:w-auto">
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
