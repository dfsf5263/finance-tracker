export function getPageTitle(pathname: string): string {
  const routeTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/transactions': 'Transactions',
    '/dashboard/analytics/breakdown': 'Analytics - Breakdown',
    '/dashboard/analytics/money-flow': 'Analytics - Money Flow',
    '/dashboard/budgeting/audit': 'Budgeting - Audit',
    '/dashboard/definitions': 'Definitions',
    '/dashboard/definitions/households': 'Definitions - Households',
    '/dashboard/definitions/categories': 'Definitions - Categories',
    '/dashboard/definitions/users': 'Definitions - Users',
    '/dashboard/definitions/types': 'Definitions - Transaction Types',
    '/dashboard/definitions/accounts': 'Definitions - Accounts',
    '/dashboard/settings': 'Settings',
  }

  // Handle dynamic household settings routes
  if (pathname.startsWith('/dashboard/households/') && pathname.endsWith('/settings')) {
    return 'Household Settings'
  }

  return routeTitles[pathname] || 'Dashboard'
}
