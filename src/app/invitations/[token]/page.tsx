'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, Home, Calendar, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface InvitationData {
  id: string
  household: {
    id: string
    name: string
    _count: {
      members: number
    }
  }
  inviter: {
    firstName: string | null
    lastName: string | null
    email: string
  }
  role: 'OWNER' | 'MEMBER' | 'VIEWER'
  createdAt: string
  expiresAt: string
}

export default function InvitationPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const token = params.token as string

  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInvitation = useCallback(async () => {
    try {
      const response = await fetch(`/api/invitations/by-token/${token}`)
      if (response.ok) {
        const data = await response.json()
        setInvitation(data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load invitation')
      }
    } catch {
      setError('Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchInvitation()
    }
  }, [token, fetchInvitation])

  const handleAcceptInvitation = async () => {
    if (!session?.user || !invitation) {
      router.push('/sign-in')
      return
    }

    setAccepting(true)
    try {
      const response = await fetch(`/api/invitations/by-token/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: invitation.role }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Successfully joined ${data.household.name}!`)
        router.push('/dashboard')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to accept invitation')
      }
    } catch {
      toast.error('Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  const getDisplayName = (inviter: InvitationData['inviter']) => {
    if (inviter.firstName && inviter.lastName) {
      return `${inviter.firstName} ${inviter.lastName}`
    }
    if (inviter.firstName) {
      return inviter.firstName
    }
    return inviter.email
  }

  const getRoleInfo = (role: 'OWNER' | 'MEMBER' | 'VIEWER') => {
    switch (role) {
      case 'OWNER':
        return { variant: 'destructive' as const, description: 'Full control including settings' }
      case 'MEMBER':
        return { variant: 'default' as const, description: 'Full access to household data' }
      case 'VIEWER':
        return { variant: 'secondary' as const, description: 'View-only access' }
    }
  }

  if (loading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-center min-h-[50vh]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-center min-h-[50vh]">
              <Card className="max-w-md w-full p-4">
                <CardHeader className="text-center">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <CardTitle>Invitation Error</CardTitle>
                  <CardDescription>{error}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-center min-h-[50vh]">
              <Card className="max-w-md w-full p-4">
                <CardHeader className="text-center">
                  <CardTitle>Invitation Not Found</CardTitle>
                  <CardDescription>
                    This invitation link is not valid or has expired.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-center min-h-[50vh]">
              <Card className="max-w-md w-full p-4">
                <CardHeader className="text-center">
                  <Home className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Join {invitation.household.name}</CardTitle>
                  <CardDescription>You need to sign in to accept this invitation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Invited by {getDisplayName(invitation.inviter)}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{invitation.household._count.members} members</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Expires {format(new Date(invitation.expiresAt), 'PPP')}</span>
                    </div>
                  </div>
                  <Button onClick={() => router.push('/sign-in')} className="w-full">
                    Sign In to Join
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Card className="max-w-md w-full p-4">
              <CardHeader className="text-center">
                <Home className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Join {invitation.household.name}</CardTitle>
                <CardDescription>You&apos;ve been invited to join this household</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Invited by {getDisplayName(invitation.inviter)}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{invitation.household._count.members} members</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Expires {format(new Date(invitation.expiresAt), 'PPP')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">You will join as:</p>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Badge variant={getRoleInfo(invitation.role).variant}>{invitation.role}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {getRoleInfo(invitation.role).description}
                    </span>
                  </div>
                </div>

                <Button onClick={handleAcceptInvitation} disabled={accepting} className="w-full">
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Joining...
                    </>
                  ) : (
                    'Accept Invitation'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
