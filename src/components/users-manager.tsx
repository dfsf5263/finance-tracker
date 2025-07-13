'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit, Trash2, Plus, Users, Info } from 'lucide-react'
import { TransactionUserForm } from './user-form'
import { useCRUD } from '@/hooks/useCRUD'
import { useHousehold } from '@/contexts/household-context'

interface TransactionUser {
  id: string
  name: string
  annualBudget?: string | number | null
  householdId?: string
}

export function UsersManager() {
  const { selectedHousehold, getUserRole } = useHousehold()
  const userRole = getUserRole(selectedHousehold?.id)
  const {
    items: users,
    formOpen,
    editingItem: editingUser,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
    canEdit,
  } = useCRUD<TransactionUser>('users', 'User', selectedHousehold?.id, userRole)

  if (!selectedHousehold) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Please select a household to manage users.
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
            Users
            {canEdit && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {users.length === 0 && (
            <Card className="bg-muted/50 border-muted mb-4">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Who are users?</p>
                    <p>
                      Users are individuals who make transactions in your household. This includes:
                    </p>
                    <ul className="mt-1 ml-4 list-disc">
                      <li>Authorized users on credit cards</li>
                      <li>Joint account holders on bank accounts</li>
                      <li>Anyone directly spending or earning money in the household</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex justify-between items-center p-2 border rounded">
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  {user.annualBudget && (
                    <span className="text-sm text-muted-foreground">
                      Budget:{' '}
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(Number(user.annualBudget))}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No users yet</h3>
                  <p className="text-muted-foreground mb-2">
                    {canEdit
                      ? 'Add the people who spend or earn money in your household.'
                      : 'No users have been added to this household yet.'}
                  </p>
                  {canEdit && (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">
                        This could be family members, authorized credit card users, or joint account
                        holders.
                      </p>
                      <Button onClick={() => setFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First User
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <TransactionUserForm
        user={editingUser}
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleCreate}
      />
    </div>
  )
}
