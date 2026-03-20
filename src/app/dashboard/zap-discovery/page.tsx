import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security Scan Route Index',
  robots: {
    index: false,
    follow: true,
  },
}

const dashboardRoutes = [
  {
    title: 'Overview',
    routes: ['/dashboard'],
  },
  {
    title: 'Transactions',
    routes: [
      '/dashboard/transactions',
      '/dashboard/transactions/manage',
      '/dashboard/transactions/upload',
    ],
  },
  {
    title: 'Analytics',
    routes: ['/dashboard/analytics/breakdown', '/dashboard/analytics/money-flow'],
  },
  {
    title: 'Budgeting',
    routes: ['/dashboard/budgeting/household-budget', '/dashboard/budgeting/user-budget'],
  },
  {
    title: 'Definitions',
    routes: [
      '/dashboard/definitions',
      '/dashboard/definitions/accounts',
      '/dashboard/definitions/categories',
      '/dashboard/definitions/households',
      '/dashboard/definitions/types',
      '/dashboard/definitions/users',
    ],
  },
  {
    title: 'Utility',
    routes: ['/dashboard/utility', '/dashboard/utility/csv-converter', '/dashboard/utility/dedupe'],
  },
  {
    title: 'Settings',
    routes: [
      '/dashboard/settings/email-subscriptions',
      '/dashboard/settings/household',
      '/dashboard/settings/profile',
      '/dashboard/settings/security',
    ],
  },
]

export default function ZapDiscoveryPage() {
  if (process.env.ENABLE_ZAP_DISCOVERY !== 'true') {
    notFound()
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Security Scan Route Index</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          This page exists only for authenticated crawler discovery in CI. It links to the protected
          dashboard routes that should be covered by the OWASP ZAP scan.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {dashboardRoutes.map((group) => (
          <section className="rounded-lg border p-4" key={group.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {group.routes.map((route) => (
                <li key={route}>
                  <Link
                    className="text-sm text-primary underline-offset-4 hover:underline"
                    href={route}
                  >
                    {route}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
