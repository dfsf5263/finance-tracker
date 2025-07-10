import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { invalidateActiveMonthCache } from './use-active-month'

export function useCRUD<T extends { id: string }>(
  apiEndpoint: string,
  entityName: string,
  householdId?: string
) {
  const [items, setItems] = useState<T[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<T | undefined>()

  const fetchItems = useCallback(async () => {
    try {
      const url = householdId
        ? `/api/${apiEndpoint}?householdId=${householdId}`
        : `/api/${apiEndpoint}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error(`Failed to fetch ${entityName}:`, error)
    }
  }, [apiEndpoint, entityName, householdId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleCreate = async (itemData: Omit<T, 'id'>) => {
    try {
      const isEditing = !!editingItem
      const url = isEditing ? `/api/${apiEndpoint}/${editingItem.id}` : `/api/${apiEndpoint}`
      const method = isEditing ? 'PUT' : 'POST'

      // Include householdId in the request body for create operations
      const bodyData = !isEditing && householdId ? { ...itemData, householdId } : itemData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      })
      if (response.ok) {
        setFormOpen(false)
        setEditingItem(undefined)
        fetchItems()
        toast.success(`${entityName} ${isEditing ? 'updated' : 'created'} successfully`)

        // Invalidate active month cache if this is a transaction
        if (apiEndpoint === 'transactions' && householdId) {
          invalidateActiveMonthCache(householdId)
        }
      }
    } catch (error) {
      console.error(`Failed to ${editingItem ? 'update' : 'create'} ${entityName}:`, error)
      toast.error(`Failed to ${editingItem ? 'update' : 'create'} ${entityName}`)
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
        toast.success(`${entityName} deleted successfully`)

        // Invalidate active month cache if this is a transaction
        if (apiEndpoint === 'transactions' && householdId) {
          invalidateActiveMonthCache(householdId)
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || `Failed to delete ${entityName}`)
      }
    } catch (error) {
      console.error(`Failed to delete ${entityName}:`, error)
      toast.error(`Failed to delete ${entityName}`)
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
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
    fetchItems,
  }
}
