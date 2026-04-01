'use client'

import { useState, useEffect, useCallback } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Key, Copy, Trash2, Plus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ApiKeyItem {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean
  expiresAt: Date | null
  createdAt: Date
  lastRequest: Date | null
  requestCount: number
}

export function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Create form state
  const [keyName, setKeyName] = useState('')
  const [expiresIn, setExpiresIn] = useState<string>('never')

  const fetchKeys = useCallback(async () => {
    try {
      const result = await authClient.apiKey.list()
      if (result.data) {
        setApiKeys(result.data.apiKeys as ApiKeyItem[])
      }
    } catch {
      toast.error('Failed to load API keys')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreate = async () => {
    if (!keyName.trim()) {
      toast.error('Please enter a name for the API key')
      return
    }

    setIsCreating(true)
    try {
      const body: { name: string; expiresIn?: number | null } = { name: keyName.trim() }
      if (expiresIn === 'never') {
        body.expiresIn = null
      } else {
        body.expiresIn = Number(expiresIn)
      }

      const result = await authClient.apiKey.create(body)
      if (result.error) {
        toast.error(result.error.message ?? 'Failed to create API key')
        return
      }

      if (result.data) {
        setNewKeyValue(result.data.key)
        await fetchKeys()
        toast.success('API key created')
      }
    } catch {
      toast.error('Failed to create API key')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (keyId: string) => {
    setDeletingId(keyId)
    try {
      const result = await authClient.apiKey.delete({ keyId })
      if (result.error) {
        toast.error(result.error.message ?? 'Failed to delete API key')
        return
      }
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId))
      toast.success('API key deleted')
    } catch {
      toast.error('Failed to delete API key')
    } finally {
      setDeletingId(null)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const resetCreateForm = () => {
    setKeyName('')
    setExpiresIn('never')
    setNewKeyValue(null)
    setShowCreateDialog(false)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return <div className="text-muted-foreground py-4 text-sm">Loading API keys...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {apiKeys.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((apiKey) => (
              <TableRow key={apiKey.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Key className="text-muted-foreground h-4 w-4" />
                    {apiKey.name ?? 'Unnamed'}
                    {!apiKey.enabled && (
                      <Badge variant="secondary" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-muted-foreground text-xs">
                    {apiKey.start ?? apiKey.prefix ?? '••••••'}••••••
                  </code>
                </TableCell>
                <TableCell className="text-sm">{formatDate(apiKey.createdAt)}</TableCell>
                <TableCell className="text-sm">
                  {apiKey.expiresAt ? (
                    new Date(apiKey.expiresAt) < new Date() ? (
                      <Badge variant="destructive" className="text-xs">
                        Expired
                      </Badge>
                    ) : (
                      formatDate(apiKey.expiresAt)
                    )
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{formatDate(apiKey.lastRequest)}</TableCell>
                <TableCell className="text-sm">{apiKey.requestCount}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(apiKey.id)}
                    disabled={deletingId === apiKey.id}
                    aria-label={`Delete API key ${apiKey.name ?? 'Unnamed'}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm">
          <Key className="h-8 w-8 opacity-50" />
          <p>No API keys yet</p>
          <p className="text-xs">Create one to start making programmatic API requests.</p>
        </div>
      )}

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKeyValue ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {newKeyValue
                ? 'Copy this key now — you will not be able to see it again.'
                : 'Give your API key a name and optionally set an expiration.'}
            </DialogDescription>
          </DialogHeader>

          {newKeyValue ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Store this key securely. It will only be shown once.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border bg-muted p-3 text-xs break-all">
                  {newKeyValue}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newKeyValue)}
                  aria-label="Copy API key to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button className="w-full" onClick={resetCreateForm}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. CI Pipeline, Data Import Script"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  maxLength={32}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-expires">Expiration</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger id="key-expires">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create API Key'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
