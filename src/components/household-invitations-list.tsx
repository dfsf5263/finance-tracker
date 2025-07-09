'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Copy, Trash2, Calendar, User } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Invitation {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  token: string
  role: 'OWNER' | 'MEMBER' | 'VIEWER'
  createdAt: string
  expiresAt: string
  household: {
    name: string
  }
  inviter: {
    firstName: string | null
    lastName: string | null
    email: string
  }
  invitee: {
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

interface HouseholdInvitationsListProps {
  householdId: string
}

export function HouseholdInvitationsList({ householdId }: HouseholdInvitationsListProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await fetch(`/api/households/${householdId}/invitations`)
      if (response.ok) {
        const data = await response.json()
        setInvitations(data)
      } else {
        toast.error('Failed to load invitations')
      }
    } catch {
      toast.error('Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  const deleteInvitation = async (invitationId: string) => {
    setDeleting(invitationId)
    try {
      const response = await fetch(`/api/invitations/by-id/${invitationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Invitation deleted successfully')
        await fetchInvitations()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to delete invitation')
      }
    } catch {
      toast.error('Failed to delete invitation')
    } finally {
      setDeleting(null)
    }
  }

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/invitations/${token}`
    navigator.clipboard.writeText(link)
    toast.success('Invitation link copied to clipboard')
  }

  const getDisplayName = (person: {
    firstName: string | null
    lastName: string | null
    email: string
  }) => {
    if (person.firstName && person.lastName) {
      return `${person.firstName} ${person.lastName}`
    }
    if (person.firstName) {
      return person.firstName
    }
    return person.email
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'default'
      case 'ACCEPTED':
        return 'secondary'
      case 'REJECTED':
        return 'destructive'
      case 'EXPIRED':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getRoleBadgeVariant = (role: 'OWNER' | 'MEMBER' | 'VIEWER') => {
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

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  if (loading) {
    return <div className="text-center py-4">Loading invitations...</div>
  }

  const activeInvitations = invitations.filter(
    (inv) => inv.status === 'PENDING' && !isExpired(inv.expiresAt)
  )
  const inactiveInvitations = invitations.filter(
    (inv) => inv.status !== 'PENDING' || isExpired(inv.expiresAt)
  )

  return (
    <div className="space-y-6">
      {/* Active Invitations */}
      <div>
        <h3 className="text-lg font-medium mb-4">
          Active Invitations ({activeInvitations.length})
        </h3>
        {activeInvitations.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No active invitations. Create an invitation to share this household.
          </p>
        ) : (
          <div className="space-y-3">
            {activeInvitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={getStatusBadgeVariant(invitation.status)}>
                          {invitation.status}
                        </Badge>
                        <Badge variant={getRoleBadgeVariant(invitation.role)}>
                          {invitation.role}
                        </Badge>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <User className="h-4 w-4 mr-1" />
                          Created by {getDisplayName(invitation.inviter)}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        Expires {format(new Date(invitation.expiresAt), 'PPP')}
                      </div>
                      <div className="text-sm font-mono bg-muted p-2 rounded">
                        {window.location.origin}/invitations/{invitation.token}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyInvitationLink(invitation.token)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={deleting === invitation.id}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Invitation</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete this invitation? This will invalidate
                              the link and prevent anyone from using it to join the household.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline">Cancel</Button>
                            <Button
                              variant="destructive"
                              onClick={() => deleteInvitation(invitation.id)}
                            >
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Invitations */}
      {inactiveInvitations.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">
            Inactive Invitations ({inactiveInvitations.length})
          </h3>
          <div className="space-y-3">
            {inactiveInvitations.map((invitation) => (
              <Card key={invitation.id} className="opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={getStatusBadgeVariant(
                            isExpired(invitation.expiresAt) ? 'EXPIRED' : invitation.status
                          )}
                        >
                          {isExpired(invitation.expiresAt) ? 'EXPIRED' : invitation.status}
                        </Badge>
                        <Badge variant={getRoleBadgeVariant(invitation.role)}>
                          {invitation.role}
                        </Badge>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <User className="h-4 w-4 mr-1" />
                          Created by {getDisplayName(invitation.inviter)}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        {isExpired(invitation.expiresAt) ? 'Expired' : 'Expires'}{' '}
                        {format(new Date(invitation.expiresAt), 'PPP')}
                      </div>
                      {invitation.invitee && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <User className="h-4 w-4 mr-1" />
                          {invitation.status === 'ACCEPTED' ? 'Accepted by' : 'Rejected by'}{' '}
                          {getDisplayName(invitation.invitee)}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteInvitation(invitation.id)}
                      disabled={deleting === invitation.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
