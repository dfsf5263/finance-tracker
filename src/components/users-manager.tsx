'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TransactionUserForm } from './user-form'
import { useCRUD } from '@/hooks/useCRUD'

interface TransactionUser {
  id: string
  name: string
}

export function UsersManager() {
  const {
    items: users,
    formOpen,
    editingItem: editingUser,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
  } = useCRUD<TransactionUser>('users', 'User')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex justify-between items-center">
            Users
            <Button onClick={() => setFormOpen(true)}>Add User</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex justify-between items-center p-2 border rounded">
                <span>{user.name}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
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
