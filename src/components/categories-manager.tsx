'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit, Trash2, Plus } from 'lucide-react'
import { TransactionCategoryForm } from './category-form'
import { useCRUD } from '@/hooks/useCRUD'

interface TransactionCategory {
  id: string
  name: string
  annualBudget?: string | number | null
}

export function CategoriesManager() {
  const {
    items: categories,
    formOpen,
    editingItem: editingCategory,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
  } = useCRUD<TransactionCategory>('categories', 'Category')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex justify-between items-center">
            Categories
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex justify-between items-center p-2 border rounded"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{category.name}</span>
                  {category.annualBudget && (
                    <span className="text-sm text-muted-foreground">
                      Budget:{' '}
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(Number(category.annualBudget))}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TransactionCategoryForm
        category={editingCategory}
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleCreate}
      />
    </div>
  )
}
