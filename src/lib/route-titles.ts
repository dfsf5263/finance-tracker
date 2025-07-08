export function getPageTitle(pathname: string): string {
  const routeTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/transactions': 'Transactions',
    '/dashboard/analytics/breakdown': 'Analytics - Breakdown',
    '/dashboard/analytics/money-flow': 'Analytics - Money Flow',
    '/dashboard/definitions': 'Definitions',
    '/dashboard/definitions/categories': 'Definitions - Categories',
    '/dashboard/definitions/users': 'Definitions - Users',
    '/dashboard/definitions/types': 'Definitions - Transaction Types',
    '/dashboard/definitions/accounts': 'Definitions - Accounts',
  }

  return routeTitles[pathname] || 'Dashboard'
}
