import { useState, useEffect, useCallback } from 'react'

export interface NotificationState {
  message: string
  type: 'error' | 'success' | 'warning'
}

export function useCRUD<T extends { id: string }>(apiEndpoint: string, entityName: string) {
  const [items, setItems] = useState<T[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<T | undefined>()
  const [notification, setNotification] = useState<NotificationState | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/${apiEndpoint}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error(`Failed to fetch ${entityName}:`, error)
    }
  }, [apiEndpoint, entityName])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleCreate = async (itemData: Omit<T, 'id'>) => {
    try {
      const isEditing = !!editingItem
      const url = isEditing ? `/api/${apiEndpoint}/${editingItem.id}` : `/api/${apiEndpoint}`
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      })
      if (response.ok) {
        setFormOpen(false)
        setEditingItem(undefined)
        fetchItems()
        setNotification({
          message: `${entityName} ${isEditing ? 'updated' : 'created'} successfully`,
          type: 'success',
        })
      }
    } catch (error) {
      console.error(`Failed to ${editingItem ? 'update' : 'create'} ${entityName}:`, error)
      setNotification({
        message: `Failed to ${editingItem ? 'update' : 'create'} ${entityName}`,
        type: 'error',
      })
    }
  }

  const handleEdit = (item: T) => {
    setEditingItem(item)
    setFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/${apiEndpoint}/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchItems()
        setNotification({ message: `${entityName} deleted successfully`, type: 'success' })
      } else {
        const errorData = await response.json()
        setNotification({
          message: errorData.error || `Failed to delete ${entityName}`,
          type: 'error',
        })
      }
    } catch (error) {
      console.error(`Failed to delete ${entityName}:`, error)
      setNotification({ message: `Failed to delete ${entityName}`, type: 'error' })
    }
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingItem(undefined)
  }

  return {
    items,
    formOpen,
    editingItem,
    notification,
    setFormOpen,
    setNotification,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
    fetchItems,
  }
}
