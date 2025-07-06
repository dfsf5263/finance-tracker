export function getPageTitle(pathname: string): string {
  const routeTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/transactions': 'Transactions',
    '/dashboard/analytics/breakdown': 'Analytics - Breakdown',
    '/dashboard/analytics/money-flow': 'Analytics - Money Flow',
    '/dashboard/management': 'Management',
    '/dashboard/management/categories': 'Management - Categories',
    '/dashboard/management/users': 'Management - Users',
    '/dashboard/management/types': 'Management - Transaction Types',
    '/dashboard/management/accounts': 'Management - Accounts',
  }

  return routeTitles[pathname] || 'Dashboard'
}
