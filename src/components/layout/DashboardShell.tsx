'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import type { User } from '@/types'
import type { HospitalConfig } from '@/lib/hospitalConfig'

interface DashboardShellProps {
  user: User
  children: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
  unreadCount?: number
  hasBranch?: boolean
  hospitalConfig?: HospitalConfig | null
}

export function DashboardShell({ user, children, breadcrumb, unreadCount = 0, hasBranch = true, hospitalConfig }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        hasBranch={hasBranch}
        hospitalConfig={hospitalConfig}
      />
      <div className="main-wrapper">
        <TopNav
          user={user}
          breadcrumb={breadcrumb}
          onMenuClick={() => setSidebarOpen(true)}
          unreadCount={unreadCount}
        />
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}
