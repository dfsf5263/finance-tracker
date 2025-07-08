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
  Settings,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'

import { NavMain } from '@/components/nav-main'
import { NavGroup } from '@/components/nav-group'
import { NavUser } from '@/components/nav-user'
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
  user: {
    name: 'Finance User',
    email: 'user@finance.com',
    avatar: '/avatars/user.jpg',
  },
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
  definitions: [
    {
      name: 'Categories',
      url: '/dashboard/definitions/categories',
      icon: Settings,
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
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavGroup title="Transactions" items={data.transactions} />
        <NavGroup title="Analytics" items={data.analytics} />
        <NavGroup title="Definitions" items={data.definitions} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
