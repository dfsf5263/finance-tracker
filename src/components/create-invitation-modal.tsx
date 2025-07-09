'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Copy, Link, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

interface CreateInvitationModalProps {
  householdId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvitationCreated: () => void
}

export function CreateInvitationModal({
  householdId,
  open,
  onOpenChange,
  onInvitationCreated,
}: CreateInvitationModalProps) {
  const [role, setRole] = useState<'OWNER' | 'MEMBER' | 'VIEWER'>('MEMBER')
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [creating, setCreating] = useState(false)
  const [invitationLink, setInvitationLink] = useState<string | null>(null)

  const handleCreateInvitation = async () => {
    setCreating(true)
    try {
      const response = await fetch(`/api/households/${householdId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, expiresInDays }),
      })

      if (response.ok) {
        const data = await response.json()
        const link = `${window.location.origin}/invitations/${data.token}`
        setInvitationLink(link)
        toast.success('Invitation created successfully!')
        onInvitationCreated()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to create invitation')
      }
    } catch {
      toast.error('Failed to create invitation')
    } finally {
      setCreating(false)
    }
  }

  const copyInvitationLink = () => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink)
      toast.success('Invitation link copied to clipboard')
    }
  }

  const handleClose = () => {
    setInvitationLink(null)
    setRole('MEMBER')
    setExpiresInDays(7)
    onOpenChange(false)
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Full control including settings and member management'
      case 'MEMBER':
        return 'Full access to household data and transactions'
      case 'VIEWER':
        return 'View-only access to household data'
      default:
        return ''
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'destructive'
      case 'MEMBER':
        return 'default'
      case 'VIEWER':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create Invitation
          </DialogTitle>
        </DialogHeader>

        {!invitationLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Member Role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as 'OWNER' | 'MEMBER' | 'VIEWER')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">VIEWER</Badge>
                      <span>View Only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="MEMBER">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">MEMBER</Badge>
                      <span>Full Access</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="OWNER">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">OWNER</Badge>
                      <span>Full Control</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{getRoleDescription(role)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Expires In</Label>
              <Select
                value={expiresInDays.toString()}
                onValueChange={(value) => setExpiresInDays(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">1 Week</SelectItem>
                  <SelectItem value="14">2 Weeks</SelectItem>
                  <SelectItem value="30">1 Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreateInvitation} disabled={creating}>
                {creating ? 'Creating...' : 'Create Invitation'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <Link className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Invitation Created!</h3>
              <p className="text-sm text-muted-foreground">
                Share this link with the person you want to invite
              </p>
            </div>

            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex items-center space-x-2">
                <Input value={invitationLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="sm" onClick={copyInvitationLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Role:</span>
                <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expires:</span>
                <span>{expiresInDays} days</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
