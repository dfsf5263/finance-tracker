'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SourceForm } from './source-form'
import { UserForm } from './user-form'
import { CategoryForm } from './category-form'
import { TypeForm } from './type-form'

interface Source {
  id: string
  name: string
}

interface User {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
}

interface TransactionType {
  id: string
  name: string
}

export function ManagementInterface() {
  const [sources, setSources] = useState<Source[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [types, setTypes] = useState<TransactionType[]>([])

  const [sourceFormOpen, setSourceFormOpen] = useState(false)
  const [userFormOpen, setUserFormOpen] = useState(false)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [typeFormOpen, setTypeFormOpen] = useState(false)

  const [editingSource, setEditingSource] = useState<Source | undefined>()
  const [editingUser, setEditingUser] = useState<User | undefined>()
  const [editingCategory, setEditingCategory] = useState<Category | undefined>()
  const [editingType, setEditingType] = useState<TransactionType | undefined>()

  const [notification, setNotification] = useState<{
    message: string
    type: 'error' | 'success' | 'warning'
  } | null>(null)

  useEffect(() => {
    fetchSources()
    fetchUsers()
    fetchCategories()
    fetchTypes()
  }, [])

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources')
      if (response.ok) {
        const data = await response.json()
        setSources(data)
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error)
    }
  }

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

  const handleCreateSource = async (sourceData: Omit<Source, 'id'>) => {
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceData),
      })
      if (response.ok) {
        setSourceFormOpen(false)
        fetchSources()
      }
    } catch (error) {
      console.error('Failed to create source:', error)
    }
  }

  const handleCreateUser = async (userData: Omit<User, 'id'>) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })
      if (response.ok) {
        setUserFormOpen(false)
        fetchUsers()
      }
    } catch (error) {
      console.error('Failed to create user:', error)
    }
  }

  const handleCreateCategory = async (categoryData: Omit<Category, 'id'>) => {
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData),
      })
      if (response.ok) {
        setCategoryFormOpen(false)
        fetchCategories()
      }
    } catch (error) {
      console.error('Failed to create category:', error)
    }
  }

  const handleCreateType = async (typeData: Omit<TransactionType, 'id'>) => {
    try {
      const response = await fetch('/api/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeData),
      })
      if (response.ok) {
        setTypeFormOpen(false)
        fetchTypes()
      }
    } catch (error) {
      console.error('Failed to create type:', error)
    }
  }

  const handleDeleteSource = async (id: string) => {
    try {
      const response = await fetch(`/api/sources/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchSources()
        setNotification({ message: 'Source deleted successfully', type: 'success' })
      } else {
        const errorData = await response.json()
        setNotification({
          message: errorData.error || 'Failed to delete source',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Failed to delete source:', error)
      setNotification({ message: 'Failed to delete source', type: 'error' })
    }
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
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Sources
              <Button onClick={() => setSourceFormOpen(true)}>Add Source</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <span>{source.name}</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteSource(source.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Users
              <Button onClick={() => setUserFormOpen(true)}>Add User</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex justify-between items-center p-2 border rounded">
                  <span>{user.name}</span>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Categories
              <Button onClick={() => setCategoryFormOpen(true)}>Add Category</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <span>{category.name}</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteCategory(category.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Transaction Types
              <Button onClick={() => setTypeFormOpen(true)}>Add Type</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {types.map((type) => (
                <div key={type.id} className="flex justify-between items-center p-2 border rounded">
                  <span>{type.name}</span>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteType(type.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <SourceForm
        source={editingSource}
        open={sourceFormOpen}
        onClose={() => {
          setSourceFormOpen(false)
          setEditingSource(undefined)
        }}
        onSubmit={handleCreateSource}
      />

      <UserForm
        user={editingUser}
        open={userFormOpen}
        onClose={() => {
          setUserFormOpen(false)
          setEditingUser(undefined)
        }}
        onSubmit={handleCreateUser}
      />

      <CategoryForm
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
