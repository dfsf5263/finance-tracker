'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TransactionUserForm } from './user-form'
import { TransactionCategoryForm } from './category-form'
import { TypeForm } from './type-form'

interface TransactionUser {
  id: string
  name: string
}

interface TransactionCategory {
  id: string
  name: string
}

interface TransactionType {
  id: string
  name: string
  isOutflow?: boolean
}

export function ManagementInterface() {
  const [users, setUsers] = useState<TransactionUser[]>([])
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])

  const [userFormOpen, setUserFormOpen] = useState(false)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [typeFormOpen, setTypeFormOpen] = useState(false)

  const [editingUser, setEditingUser] = useState<TransactionUser | undefined>()
  const [editingCategory, setEditingCategory] = useState<TransactionCategory | undefined>()
  const [editingType, setEditingType] = useState<TransactionType | undefined>()

  const [notification, setNotification] = useState<{
    message: string
    type: 'error' | 'success' | 'warning'
  } | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchCategories()
    fetchTypes()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchTypes = async () => {
    try {
      const response = await fetch('/api/types')
      if (response.ok) {
        const data = await response.json()
        setTypes(data)
      }
    } catch (error) {
      console.error('Failed to fetch types:', error)
    }
  }

  const handleCreateUser = async (userData: Omit<TransactionUser, 'id'>) => {
    try {
      const isEditing = !!editingUser
      const url = isEditing ? `/api/users/${editingUser.id}` : '/api/users'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })
      if (response.ok) {
        setUserFormOpen(false)
        setEditingUser(undefined)
        fetchUsers()
        setNotification({
          message: `User ${isEditing ? 'updated' : 'created'} successfully`,
          type: 'success',
        })
      }
    } catch (error) {
      console.error(`Failed to ${editingUser ? 'update' : 'create'} user:`, error)
      setNotification({
        message: `Failed to ${editingUser ? 'update' : 'create'} user`,
        type: 'error',
      })
    }
  }

  const handleCreateCategory = async (categoryData: Omit<TransactionCategory, 'id'>) => {
    try {
      const isEditing = !!editingCategory
      const url = isEditing ? `/api/categories/${editingCategory.id}` : '/api/categories'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData),
      })
      if (response.ok) {
        setCategoryFormOpen(false)
        setEditingCategory(undefined)
        fetchCategories()
        setNotification({
          message: `Category ${isEditing ? 'updated' : 'created'} successfully`,
          type: 'success',
        })
      }
    } catch (error) {
      console.error(`Failed to ${editingCategory ? 'update' : 'create'} category:`, error)
      setNotification({
        message: `Failed to ${editingCategory ? 'update' : 'create'} category`,
        type: 'error',
      })
    }
  }

  const handleCreateType = async (typeData: Omit<TransactionType, 'id'>) => {
    try {
      const isEditing = !!editingType
      const url = isEditing ? `/api/types/${editingType.id}` : '/api/types'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeData),
      })
      if (response.ok) {
        setTypeFormOpen(false)
        setEditingType(undefined)
        fetchTypes()
        setNotification({
          message: `Transaction type ${isEditing ? 'updated' : 'created'} successfully`,
          type: 'success',
        })
      }
    } catch (error) {
      console.error(`Failed to ${editingType ? 'update' : 'create'} type:`, error)
      setNotification({
        message: `Failed to ${editingType ? 'update' : 'create'} transaction type`,
        type: 'error',
      })
    }
  }

  const handleEditUser = (user: TransactionUser) => {
    setEditingUser(user)
    setUserFormOpen(true)
  }

  const handleEditCategory = (category: TransactionCategory) => {
    setEditingCategory(category)
    setCategoryFormOpen(true)
  }

  const handleEditType = (type: TransactionType) => {
    setEditingType(type)
    setTypeFormOpen(true)
  }

  const handleDeleteUser = async (id: string) => {
    try {
      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchUsers()
        setNotification({ message: 'User deleted successfully', type: 'success' })
      } else {
        const errorData = await response.json()
        setNotification({
          message: errorData.error || 'Failed to delete user',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
      setNotification({ message: 'Failed to delete user', type: 'error' })
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchCategories()
        setNotification({ message: 'Category deleted successfully', type: 'success' })
      } else {
        const errorData = await response.json()
        setNotification({
          message: errorData.error || 'Failed to delete category',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      setNotification({ message: 'Failed to delete category', type: 'error' })
    }
  }

  const handleDeleteType = async (id: string) => {
    try {
      const response = await fetch(`/api/types/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchTypes()
        setNotification({ message: 'Transaction type deleted successfully', type: 'success' })
      } else {
        const errorData = await response.json()
        setNotification({
          message: errorData.error || 'Failed to delete transaction type',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Failed to delete type:', error)
      setNotification({ message: 'Failed to delete transaction type', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      {notification && (
        <Alert
          variant={
            notification.type === 'error'
              ? 'destructive'
              : notification.type === 'success'
                ? 'success'
                : 'warning'
          }
          dismissible
          onDismiss={() => setNotification(null)}
        >
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="p-6">
            <CardTitle className="flex justify-between items-center">
              Users
              <Button onClick={() => setUserFormOpen(true)}>Add User</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex justify-between items-center p-2 border rounded">
                  <span>{user.name}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6">
            <CardTitle className="flex justify-between items-center">
              Categories
              <Button onClick={() => setCategoryFormOpen(true)}>Add Category</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <span>{category.name}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCategory(category)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6">
            <CardTitle className="flex justify-between items-center">
              Transaction Types
              <Button onClick={() => setTypeFormOpen(true)}>Add Type</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {types.map((type) => (
                <div key={type.id} className="flex justify-between items-center p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <span>{type.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({type.isOutflow ? 'Outflow' : 'Inflow'})
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditType(type)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteType(type.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionUserForm
        user={editingUser}
        open={userFormOpen}
        onClose={() => {
          setUserFormOpen(false)
          setEditingUser(undefined)
        }}
        onSubmit={handleCreateUser}
      />

      <TransactionCategoryForm
        category={editingCategory}
        open={categoryFormOpen}
        onClose={() => {
          setCategoryFormOpen(false)
          setEditingCategory(undefined)
        }}
        onSubmit={handleCreateCategory}
      />

      <TypeForm
        type={editingType}
        open={typeFormOpen}
        onClose={() => {
          setTypeFormOpen(false)
          setEditingType(undefined)
        }}
        onSubmit={handleCreateType}
      />
    </div>
  )
}
