'use client'

import React, { useState, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, FileText, AlertCircle, Download, ExternalLink, Info } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useHousehold } from '@/contexts/household-context'
import { apiFetch } from '@/lib/http-utils'
import {
  INSTITUTIONS,
  mapCsvRow,
  validateHeaders,
  type InstitutionKey,
  type OutputRow,
} from '@/lib/csv-converter'
import { isValidCsvFile, sanitizeCellValue } from '@/lib/file-utils'
import type ExcelJS from 'exceljs'

// ── Types ───────────────────────────────────────────────────

interface HouseholdEntity {
  id: string
  name: string
  householdId: string
}

// ── Excel generation (lazy-loaded to keep initial bundle small) ─

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

async function generateExcel(
  rows: OutputRow[],
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
      listsSheet.getCell(`${listColLetter}${i + 1}`).value = name
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

  // Set number formats for the columns
  // A (Account), B (User), E (Description), F (Category), G (Type), I (Memo) = text
  for (const col of ['A', 'B', 'E', 'F', 'G', 'I']) {
    ws.getColumn(col).numFmt = '@'
  }
  // C (Transaction Date), D (Post Date) = date
  ws.getColumn('C').numFmt = 'mm/dd/yyyy'
  ws.getColumn('D').numFmt = 'mm/dd/yyyy'
  // H (Amount) = number
  ws.getColumn('H').numFmt = '#,##0.00'

  // Add data rows
  for (const row of rows) {
    ws.addRow({
      account: '',
      user: '',
      transactionDate: row.transactionDate,
      postDate: row.postDate,
      description: sanitizeCellValue(row.description),
      category: '',
      type: '',
      amount: row.amount,
      memo: '',
    })
  }

  // Hidden sheet for dropdown list values
  const listsSheet = wb.addWorksheet('_Lists', { state: 'veryHidden' })

  // Add data validation: A=accounts, B=users, F=categories, G=types
  const accountNames = accounts.map((a) => a.name)
  const userNames = users.map((u) => u.name)
  const categoryNames = categories.map((c) => c.name)
  const typeNames = types.map((t) => t.name)

  buildListValidation(accountNames, ws, listsSheet, 1, rows.length, 'A')
  buildListValidation(userNames, ws, listsSheet, 2, rows.length, 'B')
  buildListValidation(categoryNames, ws, listsSheet, 6, rows.length, 'C')
  buildListValidation(typeNames, ws, listsSheet, 7, rows.length, 'D')

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ── Component ───────────────────────────────────────────────

export function CSVConverterPage() {
  const { selectedHousehold } = useHousehold()

  const [institution, setInstitution] = useState<InstitutionKey | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const [accounts, setAccounts] = useState<HouseholdEntity[]>([])
  const [users, setUsers] = useState<HouseholdEntity[]>([])
  const [categories, setCategories] = useState<HouseholdEntity[]>([])
  const [types, setTypes] = useState<HouseholdEntity[]>([])

  // ── Entity fetching (same pattern as csv-upload-page) ─────

  const fetchEntities = useCallback(
    async (endpoint: string): Promise<HouseholdEntity[]> => {
      if (!selectedHousehold) return []
      const { data } = await apiFetch<HouseholdEntity[]>(
        `/api/${endpoint}?householdId=${selectedHousehold.id}`
      )
      return data ?? []
    },
    [selectedHousehold]
  )

  React.useEffect(() => {
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

  // ── File handling ─────────────────────────────────────────

  const processFile = (selectedFile: File) => {
    if (selectedFile && isValidCsvFile(selectedFile)) {
      setFile(selectedFile)
    } else {
      toast.error('Please select a valid CSV file')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) processFile(selected)
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
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) processFile(droppedFile)
  }

  // ── Convert ───────────────────────────────────────────────

  const handleConvert = async () => {
    if (!institution || !file) return
    const config = INSTITUTIONS[institution]

    setIsConverting(true)
    try {
      const Papa = await import('papaparse')
      const text = await file.text()
      const { data, errors } = Papa.default.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      })

      if (errors.length > 0) {
        toast.error(`CSV parsing failed: ${errors[0].message}`)
        return
      }

      if (data.length === 0) {
        toast.error('CSV file contains no data rows')
        return
      }

      // Validate that the expected columns exist
      const csvHeaders = Object.keys(data[0])
      const missing = validateHeaders(csvHeaders, config)
      if (missing.length > 0) {
        toast.error(`Missing expected columns: ${missing.join(', ')}`)
        return
      }

      // Map rows
      const rows: OutputRow[] = data.map((csvRow) => mapCsvRow(csvRow, config))

      const invalidDates = rows.filter((r, i) => !r.transactionDate && data[i])
      if (invalidDates.length > 0) {
        toast.warning(
          `${invalidDates.length} row(s) had unparseable dates — they will appear blank in the Excel file`
        )
      }

      const blob = await generateExcel(rows, accounts, users, categories, types)

      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const timestamp = format(new Date(), 'yyyy-MM-dd')
      a.download = `finance-tracker-import-${config.label.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Converted ${rows.length} transactions to Excel`)
    } catch (error) {
      console.error('Conversion failed:', error)
      toast.error('Failed to convert CSV. Please check the file format and try again.')
    } finally {
      setIsConverting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {!selectedHousehold && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Select a household to include dropdown validation lists (Accounts, Users, Categories,
            Types) in the generated Excel file. You can still convert without a household selected.
          </span>
        </div>
      )}

      {/* Upload form */}
      <Card>
        <CardHeader className="p-6 pb-0">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Convert Institution CSV
          </CardTitle>
          <CardDescription>
            Select your financial institution, upload the exported CSV, and download a formatted
            Excel file
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-4 space-y-4">
          {/* Institution select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Financial Institution</label>
            <Select
              value={institution ?? ''}
              onValueChange={(v) => setInstitution(v as InstitutionKey)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select an institution" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INSTITUTIONS).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Drag-and-drop zone */}
          <label
            htmlFor="csv-converter-upload"
            className={cn(
              'block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'border-muted-foreground/25 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
            )}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-converter-upload"
            />
            <FileText
              className={cn(
                'h-8 w-8 mx-auto mb-4',
                isDragOver ? 'text-blue-500' : 'text-muted-foreground'
              )}
            />
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {isDragOver ? 'Drop CSV file here' : 'Click to select CSV file or drag and drop'}
              </div>
              <div className="text-xs text-muted-foreground">Supported format: CSV files only</div>
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

          {/* Convert button */}
          <Button
            onClick={handleConvert}
            disabled={!institution || !file || isConverting}
            className="w-full sm:w-auto"
          >
            {isConverting ? (
              <>Converting...</>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Convert &amp; Download Excel
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="p-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            How to Use This Converter
          </CardTitle>
          <CardDescription className="pb-2">
            This tool converts CSV exports from your financial institution into a formatted Excel
            file that&apos;s ready for Finance Tracker import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steps */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Steps</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Export transactions as a CSV file from your financial institution&apos;s website
              </li>
              <li>Select your institution from the dropdown above</li>
              <li>Drag and drop the CSV file (or click to browse)</li>
              <li>
                Click <strong>Convert &amp; Download Excel</strong> to generate the file
              </li>
              <li>
                Open the downloaded Excel file and fill in the <strong>Account</strong>,{' '}
                <strong>User</strong>, <strong>Category</strong>, and <strong>Type</strong> columns
                using the dropdowns
              </li>
              <li>
                Save as CSV and upload via the{' '}
                <Link
                  href="/dashboard/transactions/upload"
                  className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  CSV Upload <ExternalLink className="h-3 w-3" />
                </Link>{' '}
                page
              </li>
            </ol>
          </div>

          {/* Supported institutions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Supported Institutions</h3>
            <div className="grid gap-3">
              {Object.entries(INSTITUTIONS).map(([key, cfg]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{cfg.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {cfg.dateFormat === 'iso' ? 'YYYY-MM-DD' : 'MM/DD/YYYY'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{cfg.amountNote}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mapped columns:{' '}
                    {Object.entries(cfg.mapping)
                      .map(([src, dest]) => `${src} → ${dest}`)
                      .join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Output format */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Output Excel Format</h3>
            <p className="text-sm text-muted-foreground">
              The generated Excel file follows the Finance Tracker import format with these columns:
            </p>
            <div className="grid gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Account, User, Category, Type</span>
                    <Badge variant="outline" className="text-xs">
                      Dropdown
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pre-populated with dropdown lists from your household definitions. Fill these in
                    before uploading.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    Transaction Date, Post Date, Description, Amount
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Auto-filled
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically mapped and formatted from the institution CSV. Dates are in
                  MM/DD/YYYY format, amounts use the correct sign convention (negative for
                  expenses).
                </p>
              </div>
              <div className="flex flex-col gap-2 p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">Memo</span>
                  <Badge variant="outline" className="text-xs">
                    Optional
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Left blank — add notes if needed before uploading.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
