'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Mail, Info } from 'lucide-react'
import { toast } from 'sonner'

interface EmailSubscription {
  householdId: string
  householdName: string
  weeklySummary: boolean
  role: string
}

export function EmailSubscriptionsList() {
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/users/email-subscriptions')
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data)
      } else {
        toast.error('Failed to load email subscriptions')
      }
    } catch {
      toast.error('Failed to load email subscriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const updateSubscription = async (householdId: string, weeklySummary: boolean) => {
    setUpdating(householdId)
    try {
      const response = await fetch('/api/users/email-subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, weeklySummary }),
      })

      if (response.ok) {
        setSubscriptions((prev) =>
          prev.map((sub) => (sub.householdId === householdId ? { ...sub, weeklySummary } : sub))
        )
        toast.success('Email subscription updated successfully')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to update email subscription')
      }
    } catch {
      toast.error('Failed to update email subscription')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-4">Loading email subscriptions...</div>
        </CardContent>
      </Card>
    )
  }

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Subscriptions
          </CardTitle>
          <CardDescription>
            Manage your email notification preferences for each household
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>You are not a member of any households yet.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="p-6">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Subscriptions
        </CardTitle>
        <CardDescription>
          Manage your email notification preferences for each household you belong to
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Household</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <span>Weekly Summary</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="hover:bg-accent rounded-sm p-1" type="button">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <p className="text-sm">
                        Weekly summaries provide an overview of your household&apos;s financial
                        activity for the past week, including transaction summaries and budget
                        insights.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription) => (
              <TableRow key={subscription.householdId}>
                <TableCell className="font-medium">{subscription.householdName}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-muted-foreground">
                      {subscription.weeklySummary ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={subscription.weeklySummary}
                      onCheckedChange={(checked) =>
                        updateSubscription(subscription.householdId, checked)
                      }
                      disabled={updating === subscription.householdId}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
