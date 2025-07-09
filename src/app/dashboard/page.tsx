import { SectionCards } from '@/components/section-cards'
import { OnboardingCard } from '@/components/onboarding-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <OnboardingCard />
        </div>
        <SectionCards />
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full bg-muted/50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Chart placeholder - Interactive chart will go here
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">New user registration</p>
                    <p className="text-sm text-muted-foreground">2 minutes ago</p>
                  </div>
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Payment processed</p>
                    <p className="text-sm text-muted-foreground">5 minutes ago</p>
                  </div>
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">System backup completed</p>
                    <p className="text-sm text-muted-foreground">1 hour ago</p>
                  </div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
