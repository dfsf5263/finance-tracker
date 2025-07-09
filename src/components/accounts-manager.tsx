'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit, Trash2, Plus, CreditCard, Info } from 'lucide-react'
import { AccountForm } from './account-form'
import { useCRUD } from '@/hooks/useCRUD'
import { useHousehold } from '@/contexts/household-context'

interface TransactionAccount {
  id: string
  name: string
  householdId?: string
}

export function AccountsManager() {
  const { selectedHousehold } = useHousehold()
  const {
    items: accounts,
    formOpen,
    editingItem: editingAccount,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
  } = useCRUD<TransactionAccount>('accounts', 'Account', selectedHousehold?.id)

  if (!selectedHousehold) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Please select a household to manage accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex justify-between items-center">
            Accounts
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {accounts.length === 0 && (
            <Card className="bg-muted/50 border-muted mb-4">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">What are accounts?</p>
                    <p>
                      Accounts represent your financial institutions where money flows in or out.
                    </p>
                    <p className="mt-1">
                      Examples: Chase Credit Card, Wells Fargo Checking, PayPal Account, Venmo
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex justify-between items-center p-2 border rounded"
              >
                <span>{account.name}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {accounts.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No accounts yet</h3>
                  <p className="text-muted-foreground mb-2">
                    Start by adding your financial accounts to track where money flows.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Examples: Chase Credit Card, Wells Fargo Checking, PayPal, Venmo
                  </p>
                  <Button onClick={() => setFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Account
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <AccountForm
        account={editingAccount}
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleCreate}
      />
    </div>
  )
}
