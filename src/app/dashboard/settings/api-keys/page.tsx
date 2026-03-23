'use client'

import { ApiKeysManager } from '@/components/settings/api-keys-manager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ApiKeysPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="space-y-6">
            <Card>
              <CardHeader className="p-6">
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Create and manage API keys for programmatic access to your data. API keys
                  authenticate requests using the <code>x-api-key</code> header.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ApiKeysManager />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
