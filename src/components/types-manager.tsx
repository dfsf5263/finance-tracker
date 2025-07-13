'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Plus, DollarSign, Sparkles } from 'lucide-react'
import { TypeForm } from './type-form'
import { useCRUD } from '@/hooks/useCRUD'
import { useHousehold } from '@/contexts/household-context'
import { DEFAULT_TYPES } from '@/lib/default-types'

interface TransactionType {
  id: string
  name: string
  isOutflow?: boolean
  householdId?: string
}

export function TypesManager() {
  const { selectedHousehold, getUserRole } = useHousehold()
  const [isCreatingBulk, setIsCreatingBulk] = useState(false)
  const userRole = getUserRole(selectedHousehold?.id)
  const {
    items: types,
    formOpen,
    editingItem: editingType,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
    fetchItems,
    canEdit,
  } = useCRUD<TransactionType>('types', 'Transaction type', selectedHousehold?.id, userRole)

  const handleBulkCreate = async () => {
    if (!selectedHousehold) return

    setIsCreatingBulk(true)
    try {
      const response = await fetch('/api/types/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          types: DEFAULT_TYPES,
          householdId: selectedHousehold.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(result.message)
        fetchItems() // Refresh the types list
      } else {
        console.error('Failed to create bulk types')
      }
    } catch (error) {
      console.error('Error creating bulk types:', error)
    } finally {
      setIsCreatingBulk(false)
    }
  }

  if (!selectedHousehold) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Please select a household to manage transaction types.
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
            Transaction Types
            {canEdit && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            {types.map((type) => (
              <div key={type.id} className="flex justify-between items-center p-2 border rounded">
                <div className="flex items-center gap-2">
                  <span>{type.name}</span>
                  <Badge variant={type.isOutflow ? 'negative' : 'positive'}>
                    {type.isOutflow ? 'Outflow' : 'Inflow'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(type.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {types.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No transaction types found</h3>
                  <p className="text-muted-foreground mb-4">
                    {canEdit
                      ? 'Create your first transaction type to classify inflows and outflows.'
                      : 'No transaction types have been created for this household yet.'}
                  </p>
                  {canEdit && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button onClick={() => setFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Type
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleBulkCreate}
                        disabled={isCreatingBulk}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {isCreatingBulk ? 'Creating...' : 'Prepopulate Common Types'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <TypeForm type={editingType} open={formOpen} onClose={closeForm} onSubmit={handleCreate} />
    </div>
  )
}
