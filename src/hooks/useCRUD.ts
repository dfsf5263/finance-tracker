import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { invalidateActiveMonthCache } from './use-active-month'
import { apiFetch } from '@/lib/http-utils'

export function useCRUD<T extends { id: string }>(
  apiEndpoint: string,
  entityName: string,
  householdId?: string
) {
  const [items, setItems] = useState<T[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<T | undefined>()

  const fetchItems = useCallback(async () => {
    const url = householdId
      ? `/api/${apiEndpoint}?householdId=${householdId}`
      : `/api/${apiEndpoint}`

    const { data, error } = await apiFetch<T[]>(url, {
      showErrorToast: false, // Don't show toast for fetch errors, just log
      showRateLimitToast: true, // Show rate limit toasts
    })

    if (data) {
      setItems(data)
    } else if (error) {
      console.error(`Failed to fetch ${entityName}:`, error)
    }
  }, [apiEndpoint, entityName, householdId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleCreate = async (itemData: Omit<T, 'id'>) => {
    const isEditing = !!editingItem
    const url = isEditing ? `/api/${apiEndpoint}/${editingItem.id}` : `/api/${apiEndpoint}`
    const method = isEditing ? 'PUT' : 'POST'

    // Include householdId in the request body for create operations
    const bodyData = !isEditing && householdId ? { ...itemData, householdId } : itemData

    const { data, error } = await apiFetch<T>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
      showErrorToast: false, // We'll handle success/error toasts manually
      showRateLimitToast: true, // Show rate limit toasts
    })

    if (data) {
      setFormOpen(false)
      setEditingItem(undefined)
      fetchItems()
      toast.success(`${entityName} ${isEditing ? 'updated' : 'created'} successfully`)

      // Invalidate active month cache if this is a transaction
      if (apiEndpoint === 'transactions' && householdId) {
        invalidateActiveMonthCache(householdId)
      }
    } else if (error) {
      console.error(`Failed to ${editingItem ? 'update' : 'create'} ${entityName}:`, error)
      // Only show toast if it's not a rate limit error (already handled by apiFetch)
      if (!error.includes('Rate limit exceeded')) {
        toast.error(`Failed to ${editingItem ? 'update' : 'create'} ${entityName}`)
      }
    }
  }

  const handleEdit = (item: T) => {
    setEditingItem(item)
    setFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    const { error } = await apiFetch(`/api/${apiEndpoint}/${id}`, {
      method: 'DELETE',
      showErrorToast: false, // We'll handle success/error toasts manually
      showRateLimitToast: true, // Show rate limit toasts
    })

    if (!error) {
      fetchItems()
      toast.success(`${entityName} deleted successfully`)

      // Invalidate active month cache if this is a transaction
      if (apiEndpoint === 'transactions' && householdId) {
        invalidateActiveMonthCache(householdId)
      }
    } else {
      console.error(`Failed to delete ${entityName}:`, error)
      // Only show toast if it's not a rate limit error (already handled by apiFetch)
      if (!error.includes('Rate limit exceeded')) {
        toast.error(`Failed to delete ${entityName}`)
      }
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
