'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trash2, AlertTriangle, CreditCard, User, Calendar, DollarSign } from 'lucide-react'
import { DuplicatePair } from '@/lib/duplicate-detector'
import {
  formatDuplicateScore,
  getDuplicateRiskLabel,
  getDuplicateBadgeVariant,
} from '@/lib/duplicate-utils'
import { formatCurrency, formatDateFromISO } from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'
import { canManageData } from '@/lib/role-utils'
import { apiFetch } from '@/lib/http-utils'
import { toast } from 'sonner'

interface DuplicateTransactionGridProps {
  duplicatePairs: DuplicatePair[]
  onTransactionDeleted: () => void
}

interface DeleteDialogState {
  open: boolean
  transaction: DuplicatePair['transaction1'] | null
  isPair: 'first' | 'second' | null
}

export function DuplicateTransactionGrid({
  duplicatePairs,
  onTransactionDeleted,
}: DuplicateTransactionGridProps) {
  const { getUserRole } = useHousehold()
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    transaction: null,
    isPair: null,
  })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const userRole = getUserRole()
  const canEdit = canManageData(userRole)

  const handleDeleteClick = (
    transaction: DuplicatePair['transaction1'],
    isPair: 'first' | 'second'
  ) => {
    setDeleteDialog({
      open: true,
      transaction,
      isPair,
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.transaction) return

    setDeletingId(deleteDialog.transaction.id)
    try {
      const { error } = await apiFetch(`/api/transactions/${deleteDialog.transaction.id}`, {
        method: 'DELETE',
        showErrorToast: false,
        showRateLimitToast: true,
      })

      if (!error) {
        toast.success('Transaction deleted successfully')
        onTransactionDeleted()
      } else {
        console.error('Failed to delete transaction:', error)
        if (!error.includes('Rate limit exceeded')) {
          toast.error('Failed to delete transaction')
        }
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error)
      toast.error('Failed to delete transaction')
    } finally {
      setDeletingId(null)
      setDeleteDialog({
        open: false,
        transaction: null,
        isPair: null,
      })
    }
  }

  const TransactionCard = ({
    transaction,
    label,
    isPair,
  }: {
    transaction: DuplicatePair['transaction1']
    label: string
    isPair: 'first' | 'second'
  }) => (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-muted-foreground">{label}</h4>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteClick(transaction, isPair)}
            disabled={deletingId === transaction.id}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="font-medium truncate">{transaction.description}</div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(Math.abs(transaction.amount))}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span>{formatDateFromISO(transaction.transactionDate)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <CreditCard className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{transaction.account}</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{transaction.user}</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <div>Category: {transaction.category}</div>
          <div>Type: {transaction.type}</div>
          {transaction.memo && <div>Memo: {transaction.memo}</div>}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Card className="p-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Potential Duplicate Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {duplicatePairs.map((pair, index) => (
              <div key={`${pair.transaction1.id}-${pair.transaction2.id}`} className="space-y-4">
                {/* Score Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Pair #{index + 1}</span>
                    <Badge variant={getDuplicateBadgeVariant(pair.score)}>
                      {getDuplicateRiskLabel(pair.score)} - {formatDuplicateScore(pair.score)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pair.daysDifference === 0
                      ? 'Same day'
                      : `${pair.daysDifference} day${pair.daysDifference > 1 ? 's' : ''} apart`}
                  </div>
                </div>

                {/* Transaction Pair */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TransactionCard
                    transaction={pair.transaction1}
                    label="Transaction A"
                    isPair="first"
                  />
                  <TransactionCard
                    transaction={pair.transaction2}
                    label="Transaction B"
                    isPair="second"
                  />
                </div>

                {/* Similarity Details */}
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Date Similarity: </span>
                      <span className="font-medium">{formatDuplicateScore(pair.dayScore)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description Similarity: </span>
                      <span className="font-medium">
                        {formatDuplicateScore(pair.descriptionScore)}
                      </span>
                    </div>
                  </div>
                </div>

                {index < duplicatePairs.length - 1 && <hr className="border-t border-border" />}
              </div>
            ))}
          </div>

          {!canEdit && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">View Only Access</p>
                  <p>You have view-only access to this household and cannot delete transactions.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, transaction: null, isPair: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Transaction
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {deleteDialog.transaction && (
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="font-medium text-lg truncate">
                  {deleteDialog.transaction.description}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={
                        deleteDialog.transaction.amount >= 0
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }
                    >
                      {formatCurrency(Math.abs(deleteDialog.transaction.amount))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDateFromISO(deleteDialog.transaction.transactionDate)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{deleteDialog.transaction.account}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{deleteDialog.transaction.user}</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    <span className="font-medium">Category:</span>{' '}
                    {deleteDialog.transaction.category}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {deleteDialog.transaction.type}
                  </div>
                  {deleteDialog.transaction.memo && (
                    <div>
                      <span className="font-medium">Memo:</span> {deleteDialog.transaction.memo}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteDialog({
                  open: false,
                  transaction: null,
                  isPair: null,
                })
              }
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletingId !== null}
            >
              {deletingId === deleteDialog.transaction?.id ? 'Deleting...' : 'Delete Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
