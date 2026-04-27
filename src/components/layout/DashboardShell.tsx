'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import type { User } from '@/types'

interface DashboardShellProps {
  user: User
  children: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
}

export function DashboardShell({ user, children, breadcrumb }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-wrapper">
        <TopNav
          user={user}
          breadcrumb={breadcrumb}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}
