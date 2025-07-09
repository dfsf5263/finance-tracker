'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MoreHorizontal, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { CreateInvitationModal } from '@/components/create-invitation-modal'

interface Member {
  userId: string
  role: 'OWNER' | 'MEMBER' | 'VIEWER'
  joinedAt: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

interface HouseholdMembersListProps {
  householdId: string
}

export function HouseholdMembersList({ householdId }: HouseholdMembersListProps) {
  const { user } = useUser()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch(`/api/households/${householdId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data)

        // Find current user's role
        const currentMember = data.find(
          (m: Member) => m.user.email === user?.primaryEmailAddress?.emailAddress
        )
        if (currentMember) {
          setCurrentUserRole(currentMember.role)
        }
      } else {
        toast.error('Failed to load members')
      }
    } catch {
      toast.error('Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [householdId, user?.primaryEmailAddress?.emailAddress])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const updateMemberRole = async (userId: string, newRole: 'OWNER' | 'MEMBER' | 'VIEWER') => {
    setUpdating(userId)
    try {
      const response = await fetch(`/api/households/${householdId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        toast.success('Member role updated successfully')
        await fetchMembers()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to update member role')
      }
    } catch {
      toast.error('Failed to update member role')
    } finally {
      setUpdating(null)
    }
  }

  const removeMember = async (userId: string) => {
    setUpdating(userId)
    try {
      const response = await fetch(`/api/households/${householdId}/members/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Member removed successfully')
        await fetchMembers()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to remove member')
      }
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setUpdating(null)
    }
  }

  const getDisplayName = (member: Member) => {
    if (member.user.firstName && member.user.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`
    }
    if (member.user.firstName) {
      return member.user.firstName
    }
    return member.user.email
  }

  const getInitials = (member: Member) => {
    if (member.user.firstName && member.user.lastName) {
      return `${member.user.firstName[0]}${member.user.lastName[0]}`
    }
    if (member.user.firstName) {
      return member.user.firstName[0]
    }
    return member.user.email[0]
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

  const canManageMembers = currentUserRole === 'OWNER'
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress

  if (loading) {
    return <div className="text-center py-4">Loading members...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Members ({members.length})</h3>
        {canManageMembers && (
          <Button onClick={() => setShowInviteModal(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center justify-between p-3 rounded-lg border"
          >
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{getInitials(member).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{getDisplayName(member)}</p>
                <p className="text-sm text-muted-foreground">{member.user.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
              {canManageMembers && member.user.email !== currentUserEmail && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={updating === member.userId}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateMemberRole(member.userId, 'OWNER')}>
                      Make Owner
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMemberRole(member.userId, 'MEMBER')}>
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMemberRole(member.userId, 'VIEWER')}>
                      Make Viewer
                    </DropdownMenuItem>
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          Remove Member
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Remove Member</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to remove {getDisplayName(member)} from this
                            household? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline">Cancel</Button>
                          <Button variant="destructive" onClick={() => removeMember(member.userId)}>
                            Remove
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateInvitationModal
        householdId={householdId}
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        onInvitationCreated={fetchMembers}
      />
    </div>
  )
}
