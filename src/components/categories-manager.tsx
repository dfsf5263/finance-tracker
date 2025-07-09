'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit, Trash2, Plus, Tag, Sparkles } from 'lucide-react'
import { TransactionCategoryForm } from './category-form'
import { useCRUD } from '@/hooks/useCRUD'
import { useHousehold } from '@/contexts/household-context'
import { DEFAULT_CATEGORIES } from '@/lib/default-categories'

interface TransactionCategory {
  id: string
  name: string
  annualBudget?: string | number | null
  householdId?: string
}

export function CategoriesManager() {
  const { selectedHousehold } = useHousehold()
  const [isCreatingBulk, setIsCreatingBulk] = useState(false)
  const {
    items: categories,
    formOpen,
    editingItem: editingCategory,
    setFormOpen,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
    fetchItems,
  } = useCRUD<TransactionCategory>('categories', 'Category', selectedHousehold?.id)

  const handleBulkCreate = async () => {
    if (!selectedHousehold) return

    setIsCreatingBulk(true)
    try {
      const response = await fetch('/api/categories/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: DEFAULT_CATEGORIES,
          householdId: selectedHousehold.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(result.message)
        fetchItems() // Refresh the categories list
      } else {
        console.error('Failed to create bulk categories')
      }
    } catch (error) {
      console.error('Error creating bulk categories:', error)
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
              Please select a household to manage categories.
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

            {categories.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No categories found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first category to organize your transactions by type.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => setFormOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Category
                    </Button>
                    <Button variant="outline" onClick={handleBulkCreate} disabled={isCreatingBulk}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isCreatingBulk ? 'Creating...' : 'Prepopulate Common Categories'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
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
