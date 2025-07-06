'use client'

import * as React from 'react'
import Image from 'next/image'
import { CreditCard, DollarSign, Home, PieChart, Settings, TrendingUp, Users } from 'lucide-react'

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
    {
      title: 'Transactions',
      url: '/dashboard/transactions',
      icon: CreditCard,
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
  management: [
    {
      name: 'Categories',
      url: '/dashboard/management/categories',
      icon: Settings,
    },
    {
      name: 'Accounts',
      url: '/dashboard/management/accounts',
      icon: CreditCard,
    },
    {
      name: 'Users',
      url: '/dashboard/management/users',
      icon: Users,
    },
    {
      name: 'Transaction Types',
      url: '/dashboard/management/types',
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
              <a href="/dashboard">
                <Image
                  src="/favicon-32x32.png"
                  alt="Finance Tracker"
                  width={20}
                  height={20}
                  className="!size-5"
                />
                <span className="text-base font-semibold">Finance Tracker</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavGroup title="Analytics" items={data.analytics} />
        <NavGroup title="Management" items={data.management} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
