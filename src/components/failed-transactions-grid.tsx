'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomDatePicker } from '@/components/ui/date-picker'
import { useHousehold } from '@/contexts/household-context'
import { canManageData } from '@/lib/role-utils'
import { formatCurrency } from '@/lib/utils'
import { apiFetch } from '@/lib/http-utils'
import { toast } from 'sonner'
import { X, Check, Loader2, ChevronDown, ChevronRight, ChevronLeft, Wand2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FailureIssue {
  kind: 'format' | 'entity' | 'duplicate'
  fields: string[]
  message: string
}

export interface FailureDetail {
  index: number
  row: number
  transaction: {
    account: string
    user?: string
    transactionDate: string
    postDate?: string
    description: string
    category: string
    type: string
    amount: string
    memo?: string
    rowId?: string
  }
  issues: FailureIssue[]
  existingTransaction?: {
    createdAt: string
    account: string
    amount: string
    description: string
    transactionDate: string
  }
}

type RowStatus = 'pending' | 'modified' | 'retrying' | 'succeeded' | 'failed'

interface RowState {
  failure: FailureDetail
  status: RowStatus
  editedTransactionDate: string
  editedDescription: string
  editedAmount: string
  editedAccount: string
  editedUser: string
  editedCategory: string
  editedType: string
  animatingOut: boolean
}

export interface RetryResults {
  succeeded: number
  failed: number
}

export interface FailedTransactionsGridProps {
  failures: FailureDetail[]
  householdId: string
  mode: 'preview' | 'complete'
  accounts?: Array<{ id: string; name: string }>
  users?: Array<{ id: string; name: string }>
  categories?: Array<{ id: string; name: string }>
  types?: Array<{ id: string; name: string }>
  onRowsChange?: (rows: RowState[]) => void
  onRetryComplete?: (results: RetryResults) => void
}

const PAGE_SIZE = 25

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function autoFixDescription(description: string): string {
  const match = description.match(/^(.*)\s\((\d+)\)$/)
  if (match) {
    const base = match[1]
    const next = parseInt(match[2]) + 1
    return `${base} (${next})`
  }
  return `${description} (2)`
}

/** Collect all unique field names that have issues on this failure. */
function getAffectedFields(issues: FailureIssue[]): Set<string> {
  const fields = new Set<string>()
  for (const issue of issues) {
    for (const f of issue.fields) fields.add(f)
  }
  return fields
}

/** Check if any issue has the given kind. */
function hasIssueKind(issues: FailureIssue[], kind: FailureIssue['kind']): boolean {
  return issues.some((i) => i.kind === kind)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FailedTransactionsGrid({
  failures,
  householdId,
  mode,
  accounts = [],
  users = [],
  categories = [],
  types = [],
  onRowsChange,
  onRetryComplete,
}: FailedTransactionsGridProps) {
  const { getUserRole, selectedHousehold } = useHousehold()
  const role = getUserRole(selectedHousehold?.id)
  const hasWriteAccess = canManageData(role)

  const [rows, setRows] = useState<RowState[]>(() =>
    failures.map((f) => ({
      failure: f,
      status: 'pending' as RowStatus,
      editedTransactionDate: f.transaction.transactionDate,
      editedDescription: f.transaction.description,
      editedAmount: f.transaction.amount,
      editedAccount: f.transaction.account,
      editedUser: f.transaction.user ?? '',
      editedCategory: f.transaction.category,
      editedType: f.transaction.type,
      animatingOut: false,
    }))
  )

  const [page, setPage] = useState(0)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [retryingAll, setRetryingAll] = useState(false)
  const prevRowsRef = useRef(rows)

  // Notify parent when rows change (for PREVIEW mode count tracking)
  useEffect(() => {
    if (prevRowsRef.current !== rows) {
      prevRowsRef.current = rows
      onRowsChange?.(rows)
    }
  }, [rows, onRowsChange])

  // ---------------------------------------------------------------------------
  // Row helpers
  // ---------------------------------------------------------------------------

  const visibleRows = rows.filter((r) => !r.animatingOut)
  const modifiedCount = visibleRows.filter((r) => r.status === 'modified').length
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = visibleRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const updateRow = useCallback((rowIndex: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.failure.row === rowIndex ? { ...r, ...patch } : r)))
  }, [])

  const removeRow = useCallback((rowIndex: number) => {
    setRows((prev) =>
      prev.map((r) => (r.failure.row === rowIndex ? { ...r, animatingOut: true } : r))
    )
    setTimeout(() => {
      setRows((prev) => prev.filter((r) => r.failure.row !== rowIndex))
    }, 300)
  }, [])

  const handleFieldEdit = useCallback(
    (
      rowIndex: number,
      field:
        | 'editedTransactionDate'
        | 'editedDescription'
        | 'editedAmount'
        | 'editedAccount'
        | 'editedUser'
        | 'editedCategory'
        | 'editedType',
      value: string
    ) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.failure.row !== rowIndex) return r
          const updated = { ...r, [field]: value }
          const matchesOriginal =
            updated.editedTransactionDate === r.failure.transaction.transactionDate &&
            updated.editedDescription === r.failure.transaction.description &&
            updated.editedAmount === r.failure.transaction.amount &&
            updated.editedAccount === r.failure.transaction.account &&
            updated.editedUser === (r.failure.transaction.user ?? '') &&
            updated.editedCategory === r.failure.transaction.category &&
            updated.editedType === r.failure.transaction.type
          return { ...updated, status: matchesOriginal ? 'pending' : 'modified' }
        })
      )
    },
    []
  )

  const handleAutoFix = useCallback((rowIndex: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.failure.row !== rowIndex) return r
        const newDesc = autoFixDescription(r.editedDescription)
        const matchesOriginal =
          r.editedTransactionDate === r.failure.transaction.transactionDate &&
          newDesc === r.failure.transaction.description &&
          r.editedAmount === r.failure.transaction.amount
        return {
          ...r,
          editedDescription: newDesc,
          status: matchesOriginal ? 'pending' : 'modified',
        }
      })
    )
  }, [])

  const toggleExpand = useCallback((rowNumber: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Retry (COMPLETE mode only)
  // ---------------------------------------------------------------------------

  const buildRetryTransaction = (row: RowState) => ({
    ...row.failure.transaction,
    transactionDate: row.editedTransactionDate,
    description: row.editedDescription,
    amount: row.editedAmount,
    account: row.editedAccount,
    category: row.editedCategory,
    type: row.editedType,
    user: row.editedUser || undefined,
  })

  const retrySingle = useCallback(
    async (rowIndex: number) => {
      const row = rows.find((r) => r.failure.row === rowIndex)
      if (!row) return

      updateRow(rowIndex, { status: 'retrying' })

      const { data, error } = await apiFetch<{
        success: boolean
        results: {
          successful: number
          failures: Array<{ issues?: Array<{ message: string }> }>
        }
      }>('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          transactions: [buildRetryTransaction(row)],
        }),
        showErrorToast: false,
      })

      if (data?.results?.successful === 1) {
        toast.success(`Row ${rowIndex} uploaded successfully`)
        updateRow(rowIndex, { status: 'succeeded' })
        setTimeout(() => removeRow(rowIndex), 1000)
      } else {
        const newReason =
          data?.results?.failures?.[0]?.issues?.[0]?.message || error || 'Upload failed'
        toast.error(`Row ${rowIndex} failed: ${newReason}`)
        updateRow(rowIndex, { status: 'failed' })
      }
    },
    [rows, householdId, updateRow, removeRow]
  )

  const retryAll = useCallback(async () => {
    const retryable = rows.filter((r) => !r.animatingOut && r.status !== 'succeeded')
    if (retryable.length === 0) return

    setRetryingAll(true)

    // Ensure every retry transaction has a rowId for reliable round-trip matching
    const rowIdToOriginalRow = new Map<string, number>()
    const transactions = retryable.map((row) => {
      const tx = buildRetryTransaction(row)
      const rowId = tx.rowId || crypto.randomUUID()
      rowIdToOriginalRow.set(rowId, row.failure.row)
      return { ...tx, rowId }
    })

    const { data, error } = await apiFetch<{
      success: boolean
      results: {
        successful: number
        failed: number
        failures: Array<{
          row: number
          issues?: Array<{ message: string }>
          transaction: { rowId?: string; description: string }
        }>
      }
    }>('/api/transactions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, transactions }),
      showErrorToast: false,
    })

    if (error && !data) {
      toast.error(`Retry failed: ${error}`)
      setRetryingAll(false)
      return
    }

    const results = data!.results
    const failedOriginalRows = new Set(
      (results.failures ?? [])
        .map((f) => (f.transaction.rowId ? rowIdToOriginalRow.get(f.transaction.rowId) : undefined))
        .filter((row): row is number => row != null)
    )

    setRows((prev) =>
      prev.map((r) => {
        if (r.animatingOut || r.status === 'succeeded') return r
        if (failedOriginalRows.has(r.failure.row)) {
          return { ...r, status: 'failed' as RowStatus }
        }
        return { ...r, status: 'succeeded' as RowStatus, animatingOut: true }
      })
    )

    setTimeout(() => {
      setRows((prev) => prev.filter((r) => r.status !== 'succeeded'))
    }, 1000)

    toast.success(`${results.successful} succeeded, ${results.failed} failed`)
    setRetryingAll(false)
    onRetryComplete?.({ succeeded: results.successful, failed: results.failed })
  }, [rows, householdId, onRetryComplete])

  const dismissAll = useCallback(() => {
    setRows((prev) => prev.map((r) => ({ ...r, animatingOut: true })))
    setTimeout(() => setRows([]), 300)
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (visibleRows.length === 0) return null

  const colCount = hasWriteAccess ? 4 : 3

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {visibleRows.length} remaining
          {modifiedCount > 0 && ` · ${modifiedCount} fixed`}
        </p>
        {mode === 'complete' && hasWriteAccess && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={dismissAll}>
              Dismiss All
            </Button>
            <Button size="sm" onClick={retryAll} disabled={retryingAll}>
              {retryingAll && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Retry All
            </Button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Row</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-24">Status</TableHead>
              {hasWriteAccess && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => {
              const isExpanded = expandedRows.has(row.failure.row)

              return (
                <RowGroup
                  key={row.failure.row}
                  row={row}
                  isExpanded={isExpanded}
                  hasWriteAccess={hasWriteAccess}
                  colCount={colCount}
                  mode={mode}
                  accounts={accounts}
                  users={users}
                  categories={categories}
                  types={types}
                  onFieldEdit={handleFieldEdit}
                  onAutoFix={handleAutoFix}
                  onRemove={removeRow}
                  onRetry={retrySingle}
                  onToggleExpand={toggleExpand}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {safePage * PAGE_SIZE + 1}–
            {Math.min((safePage + 1) * PAGE_SIZE, visibleRows.length)} of {visibleRows.length}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={safePage === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row sub-component
// ---------------------------------------------------------------------------

interface RowGroupProps {
  row: RowState
  isExpanded: boolean
  hasWriteAccess: boolean
  colCount: number
  mode: 'preview' | 'complete'
  accounts: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string }>
  types: Array<{ id: string; name: string }>
  onFieldEdit: (
    rowIndex: number,
    field:
      | 'editedTransactionDate'
      | 'editedDescription'
      | 'editedAmount'
      | 'editedAccount'
      | 'editedUser'
      | 'editedCategory'
      | 'editedType',
    value: string
  ) => void
  onAutoFix: (rowIndex: number) => void
  onRemove: (rowIndex: number) => void
  onRetry: (rowIndex: number) => void
  onToggleExpand: (rowNumber: number) => void
}

function RowGroup({
  row,
  isExpanded,
  hasWriteAccess,
  colCount,
  mode,
  accounts,
  users,
  categories,
  types,
  onFieldEdit,
  onAutoFix,
  onRemove,
  onRetry,
  onToggleExpand,
}: RowGroupProps) {
  const rowNum = row.failure.row
  const tx = row.failure.transaction
  const issues = row.failure.issues
  const affectedFields = getAffectedFields(issues)
  const isDuplicate = hasIssueKind(issues, 'duplicate')
  const isEditable = hasWriteAccess && row.status !== 'retrying' && row.status !== 'succeeded'

  // Check if any affected field still matches its original (bad) value
  const hasUnresolved =
    affectedFields.size > 0 &&
    [...affectedFields].some((field) => {
      if (field === 'transactionDate') return row.editedTransactionDate === tx.transactionDate
      if (field === 'description') return row.editedDescription === tx.description
      if (field === 'amount') return row.editedAmount === tx.amount
      if (field === 'account') return row.editedAccount === tx.account
      if (field === 'user') return row.editedUser === (tx.user ?? '')
      if (field === 'category') return row.editedCategory === tx.category
      if (field === 'type') return row.editedType === tx.type
      return false
    })

  // Build summary text: issue messages
  const issueMessages = issues.map((i) => i.message).join('; ')

  const statusVariant: Record<RowStatus, 'secondary' | 'outline' | 'default' | 'destructive'> = {
    pending: 'secondary',
    modified: 'outline',
    retrying: 'default',
    succeeded: 'default',
    failed: 'destructive',
  }

  const rowClass = [
    row.animatingOut && 'opacity-0 transition-opacity duration-300',
    row.status === 'modified' && 'bg-yellow-50 dark:bg-yellow-950/20',
    row.status === 'succeeded' && 'bg-green-50 dark:bg-green-950/20',
    row.status === 'failed' && 'bg-red-50 dark:bg-red-950/20',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <TableRow className={rowClass}>
        {/* Row number */}
        <TableCell className="font-mono text-xs">
          <button
            className="flex items-center gap-1"
            onClick={() => onToggleExpand(rowNum)}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {rowNum}
          </button>
          {!isExpanded && hasUnresolved && (
            <Badge variant="destructive" className="mt-1 text-[10px] px-1 py-0">
              Fix required
            </Badge>
          )}
        </TableCell>

        {/* Summary */}
        <TableCell>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{tx.description}</p>
            <p className="text-muted-foreground truncate text-xs">{issueMessages}</p>
          </div>
        </TableCell>

        {/* Status */}
        <TableCell>
          <Badge variant={statusVariant[row.status]} className="text-xs">
            {row.status}
          </Badge>
        </TableCell>

        {/* Actions */}
        {hasWriteAccess && (
          <TableCell>
            <div className="flex gap-1">
              {mode === 'complete' && row.status !== 'succeeded' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onRetry(rowNum)}
                  disabled={row.status === 'retrying'}
                  aria-label="Retry row"
                >
                  {row.status === 'retrying' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
              )}
              {row.status !== 'succeeded' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onRemove(rowNum)}
                  aria-label="Remove row"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>

      {/* Expandable detail row */}
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={colCount} className="p-0">
            <div className="space-y-4 px-6 py-3">
              {/* Issue badges */}
              <div className="flex flex-wrap gap-2">
                {issues.map((issue, i) => (
                  <Badge
                    key={i}
                    variant={issue.kind === 'duplicate' ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {issue.message}
                  </Badge>
                ))}
              </div>

              {/* Editable fields — only for fields with issues */}
              {affectedFields.size > 0 && isEditable && (
                <div>
                  <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
                    Fix Required Fields
                  </p>
                  <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                    {affectedFields.has('transactionDate') && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground block text-xs">
                          Transaction Date
                        </label>
                        <CustomDatePicker
                          value={row.editedTransactionDate}
                          onChange={(date) => onFieldEdit(rowNum, 'editedTransactionDate', date)}
                          className={`h-8 py-1 text-xs ${
                            row.editedTransactionDate === tx.transactionDate
                              ? 'border-destructive ring-1 ring-destructive'
                              : ''
                          }`}
                        />
                      </div>
                    )}

                    {affectedFields.has('description') && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">Description</label>
                        <div className="flex items-center gap-1">
                          <Input
                            value={row.editedDescription}
                            onChange={(e) =>
                              onFieldEdit(rowNum, 'editedDescription', e.target.value)
                            }
                            className={`h-8 text-xs ${
                              row.editedDescription === tx.description
                                ? 'border-destructive ring-1 ring-destructive'
                                : ''
                            }`}
                          />
                          {isDuplicate && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 p-0"
                              onClick={() => onAutoFix(rowNum)}
                              title="Auto-fix: append suffix to description"
                              aria-label="Auto-fix description"
                            >
                              <Wand2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {affectedFields.has('amount') && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">Amount</label>
                        <Input
                          value={row.editedAmount}
                          onChange={(e) => onFieldEdit(rowNum, 'editedAmount', e.target.value)}
                          className={`h-8 text-xs ${
                            row.editedAmount === tx.amount
                              ? 'border-destructive ring-1 ring-destructive'
                              : ''
                          }`}
                        />
                      </div>
                    )}

                    {affectedFields.has('account') && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">Account</label>
                        <Select
                          value={
                            accounts.some((a) => a.name === row.editedAccount)
                              ? row.editedAccount
                              : ''
                          }
                          onValueChange={(v) => onFieldEdit(rowNum, 'editedAccount', v)}
                        >
                          <SelectTrigger
                            size="sm"
                            className={`py-1 text-xs ${
                              row.editedAccount === tx.account
                                ? 'border-destructive ring-1 ring-destructive'
                                : ''
                            }`}
                          >
                            <SelectValue placeholder="Select account…" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.name}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {affectedFields.has('category') && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">Category</label>
                        <Select
                          value={
                            categories.some((c) => c.name === row.editedCategory)
                              ? row.editedCategory
                              : ''
                          }
                          onValueChange={(v) => onFieldEdit(rowNum, 'editedCategory', v)}
                        >
                          <SelectTrigger
                            size="sm"
                            className={`py-1 text-xs ${
                              row.editedCategory === tx.category
                                ? 'border-destructive ring-1 ring-destructive'
                                : ''
                            }`}
                          >
                            <SelectValue placeholder="Select category…" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {affectedFields.has('type') && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">Type</label>
                        <Select
                          value={types.some((t) => t.name === row.editedType) ? row.editedType : ''}
                          onValueChange={(v) => onFieldEdit(rowNum, 'editedType', v)}
                        >
                          <SelectTrigger
                            size="sm"
                            className={`py-1 text-xs ${
                              row.editedType === tx.type
                                ? 'border-destructive ring-1 ring-destructive'
                                : ''
                            }`}
                          >
                            <SelectValue placeholder="Select type…" />
                          </SelectTrigger>
                          <SelectContent>
                            {types.map((t) => (
                              <SelectItem key={t.id} value={t.name}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {affectedFields.has('user') && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">User</label>
                        <Select
                          value={
                            row.editedUser === ''
                              ? '__none__'
                              : users.some((u) => u.name === row.editedUser)
                                ? row.editedUser
                                : ''
                          }
                          onValueChange={(v) =>
                            onFieldEdit(rowNum, 'editedUser', v === '__none__' ? '' : v)
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className={`py-1 text-xs ${
                              row.editedUser === (tx.user ?? '')
                                ? 'border-destructive ring-1 ring-destructive'
                                : ''
                            }`}
                          >
                            <SelectValue placeholder="Select user…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No user (household-level)</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.name}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Existing transaction (duplicates only) */}
              {isDuplicate && row.failure.existingTransaction && (
                <div className="rounded-md border border-dashed p-3">
                  <p className="text-muted-foreground mb-1.5 text-xs font-medium">
                    Existing Transaction
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">Description</span>
                      <p className="font-medium">{row.failure.existingTransaction.description}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount</span>
                      <p className="font-medium">
                        {formatCurrency(parseFloat(row.failure.existingTransaction.amount))}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transaction Date</span>
                      <p className="font-medium">
                        {row.failure.existingTransaction.transactionDate}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Read-only fields (those NOT affected by issues) */}
              <div>
                <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
                  Transaction Details
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs sm:grid-cols-4">
                  {!affectedFields.has('account') && (
                    <div>
                      <span className="text-muted-foreground">Account</span>
                      <p className="font-medium">{row.editedAccount}</p>
                    </div>
                  )}
                  {!affectedFields.has('transactionDate') && (
                    <div>
                      <span className="text-muted-foreground">Date</span>
                      <p className="font-medium">{row.editedTransactionDate}</p>
                    </div>
                  )}
                  {!affectedFields.has('description') && (
                    <div>
                      <span className="text-muted-foreground">Description</span>
                      <p className="font-medium">{row.editedDescription}</p>
                    </div>
                  )}
                  {!affectedFields.has('amount') && (
                    <div>
                      <span className="text-muted-foreground">Amount</span>
                      <p className="font-medium">
                        {formatCurrency(parseFloat(row.editedAmount) || 0)}
                      </p>
                    </div>
                  )}
                  {!affectedFields.has('category') && (
                    <div>
                      <span className="text-muted-foreground">Category</span>
                      <p className="font-medium">{row.editedCategory || '—'}</p>
                    </div>
                  )}
                  {!affectedFields.has('type') && (
                    <div>
                      <span className="text-muted-foreground">Type</span>
                      <p className="font-medium">{row.editedType || '—'}</p>
                    </div>
                  )}
                  {tx.user && !affectedFields.has('user') && (
                    <div>
                      <span className="text-muted-foreground">User</span>
                      <p className="font-medium">{row.editedUser || tx.user}</p>
                    </div>
                  )}
                  {tx.memo && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Memo</span>
                      <p className="font-medium">{tx.memo}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// Re-export RowState for parent usage
export type { RowState }
