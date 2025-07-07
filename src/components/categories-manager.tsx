'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TransactionCategoryForm } from './category-form'
import { useCRUD } from '@/hooks/useCRUD'

interface TransactionCategory {
  id: string
  name: string
}

export function CategoriesManager() {
  const {
    items: categories,
    formOpen,
    editingItem: editingCategory,
    notification,
    setFormOpen,
    setNotification,
    handleCreate,
    handleEdit,
    handleDelete,
    closeForm,
  } = useCRUD<TransactionCategory>('categories', 'Category')

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

      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex justify-between items-center">
            Categories
            <Button onClick={() => setFormOpen(true)}>Add Category</Button>
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
                  <Button variant="outline" size="sm" onClick={() => handleEdit(category)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(category.id)}>
                    Delete
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
