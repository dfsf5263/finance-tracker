'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Tag, Users, CreditCard, DollarSign, ArrowRight, Rocket } from 'lucide-react'
import { useEntityCounts } from '@/hooks/useEntityCounts'
import { useHousehold } from '@/contexts/household-context'

interface OnboardingCardProps {
  householdId?: string
  householdName?: string
}

interface EntityDefinition {
  key: keyof ReturnType<typeof useEntityCounts>['counts']
  name: string
  description: string
  route: string
  icon: React.ComponentType<{ className?: string }>
}

const entityDefinitions: EntityDefinition[] = [
  {
    key: 'categories',
    name: 'Categories',
    description: 'Organize your transactions',
    route: '/dashboard/definitions/categories',
    icon: Tag,
  },
  {
    key: 'users',
    name: 'Users',
    description: 'Track who makes transactions',
    route: '/dashboard/definitions/users',
    icon: Users,
  },
  {
    key: 'accounts',
    name: 'Accounts',
    description: 'Add your financial institutions',
    route: '/dashboard/definitions/accounts',
    icon: CreditCard,
  },
  {
    key: 'types',
    name: 'Transaction Types',
    description: 'Classify inflows and outflows',
    route: '/dashboard/definitions/types',
    icon: DollarSign,
  },
]

export function OnboardingCard({ householdId, householdName }: OnboardingCardProps) {
  const { selectedHousehold } = useHousehold()
  const actualHouseholdId = householdId || selectedHousehold?.id
  const actualHouseholdName = householdName || selectedHousehold?.name
  const { counts, isLoading } = useEntityCounts(actualHouseholdId)

  if (isLoading || !actualHouseholdId) {
    return null
  }

  // Calculate completion status
  const completedEntities = entityDefinitions.filter((entity) => counts[entity.key] > 0)
  const incompleteEntities = entityDefinitions.filter((entity) => counts[entity.key] === 0)

  // Only show onboarding if there are incomplete entities
  if (incompleteEntities.length === 0) {
    return null
  }

  const completionPercentage = Math.round(
    (completedEntities.length / entityDefinitions.length) * 100
  )

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">
              Hello there, {actualHouseholdName || 'your household'}!
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Let&apos;s set up your household for financial tracking success!
            </p>
          </div>
          <Badge variant="outline">{completionPercentage}% Complete</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          To use this application you&apos;ll need to create some basic definitions:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entityDefinitions.map((entity) => {
            const count = counts[entity.key]
            const isComplete = count > 0
            const Icon = entity.icon

            return (
              <div
                key={entity.key}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isComplete
                    ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                    : 'bg-muted/30 border-border'
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isComplete
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-medium ${
                      isComplete ? 'text-slate-900 dark:text-slate-100' : 'text-foreground'
                    }`}
                  >
                    {entity.name}
                  </span>
                  <p
                    className={`text-xs ${isComplete ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground'}`}
                  >
                    {entity.description}
                  </p>
                </div>

                {!isComplete && (
                  <Link href={entity.route}>
                    <Button size="sm" variant="outline" className="text-xs">
                      Set up
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <div className="h-1"></div>
      </CardContent>
    </Card>
  )
}
