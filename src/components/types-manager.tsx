'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit, Trash2, Plus } from 'lucide-react'
import { TypeForm } from './type-form'
import { useCRUD } from '@/hooks/useCRUD'
import { useHousehold } from '@/contexts/household-context'

interface TransactionType {
  id: string
  name: string
  isOutflow?: boolean
  householdId?: string
}

export function TypesManager() {
  const { selectedHousehold } = useHousehold()
  const {
    items: types,
    formOpen,
    editingItem: editingType,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
  } = useCRUD<TransactionType>('types', 'Transaction type', selectedHousehold?.id)

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
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
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
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(type.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TypeForm type={editingType} open={formOpen} onClose={closeForm} onSubmit={handleCreate} />
    </div>
  )
}
