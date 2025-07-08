'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AccountForm } from './account-form'
import { useCRUD } from '@/hooks/useCRUD'

interface TransactionAccount {
  id: string
  name: string
}

export function AccountsManager() {
  const {
    items: accounts,
    formOpen,
    editingItem: editingAccount,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
  } = useCRUD<TransactionAccount>('accounts', 'Account')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex justify-between items-center">
            Accounts
            <Button onClick={() => setFormOpen(true)}>Add Account</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex justify-between items-center p-2 border rounded"
              >
                <span>{account.name}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(account)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(account.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
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
