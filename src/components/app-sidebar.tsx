'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  CreditCard,
  DollarSign,
  Home,
  List,
  PieChart,
  Tag,
  Target,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'

import { NavMain } from '@/components/nav-main'
import { NavGroup } from '@/components/nav-group'
import { NavUser } from '@/components/nav-user'
import { HouseholdSelector } from '@/components/household-selector'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: Home,
    },
  ],
  transactions: [
    {
      name: 'Manage',
      url: '/dashboard/transactions/manage',
      icon: List,
    },
    {
      name: 'Upload',
      url: '/dashboard/transactions/upload',
      icon: Upload,
    },
  ],
  analytics: [
    {
      name: 'Breakdown',
      url: '/dashboard/analytics/breakdown',
      icon: PieChart,
    },
    {
      name: 'Money Flow',
      url: '/dashboard/analytics/money-flow',
      icon: TrendingUp,
    },
  ],
  budgeting: [
    {
      name: 'Household Budget',
      url: '/dashboard/budgeting/household-budget',
      icon: Target,
    },
    {
      name: 'User Budget',
      url: '/dashboard/budgeting/user-budget',
      icon: Wallet,
    },
  ],
  definitions: [
    {
      name: 'Households',
      url: '/dashboard/definitions/households',
      icon: Home,
    },
    {
      name: 'Categories',
      url: '/dashboard/definitions/categories',
      icon: Tag,
    },
    {
      name: 'Accounts',
      url: '/dashboard/definitions/accounts',
      icon: CreditCard,
    },
    {
      name: 'Users',
      url: '/dashboard/definitions/users',
      icon: Users,
    },
    {
      name: 'Transaction Types',
      url: '/dashboard/definitions/types',
      icon: DollarSign,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/dashboard">
                <Image
                  src="/favicon-32x32.png"
                  alt="Finance Tracker"
                  width={20}
                  height={20}
                  className="!size-5"
                />
                <span className="text-base font-semibold">Finance Tracker</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 pb-2">
          <HouseholdSelector />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavGroup title="Transactions" items={data.transactions} />
        <NavGroup title="Analytics" items={data.analytics} />
        <NavGroup title="Budgeting" items={data.budgeting} />
        <NavGroup title="Definitions" items={data.definitions} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
