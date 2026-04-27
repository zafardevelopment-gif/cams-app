'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/actions/auth'
import { getInitials, getRoleIcon, getRoleLabel } from '@/lib/utils'
import type { User } from '@/types'

interface NavItem {
  href: string
  icon: string
  label: string
  badge?: number
}

interface NavSection {
  label?: string
  items: NavItem[]
}

function getNavConfig(role: string): NavSection[] {
  const common: NavSection = {
    items: [
      { href: '/notifications', icon: '🔔', label: 'Notifications' },
    ],
  }

  switch (role) {
    case 'super_admin':
      return [
        {
          label: 'Platform',
          items: [
            { href: '/super-admin', icon: '📊', label: 'Overview' },
            { href: '/super-admin/hospitals', icon: '🏥', label: 'Hospitals' },
            { href: '/super-admin/users', icon: '👥', label: 'All Users' },
            { href: '/super-admin/subscriptions', icon: '💳', label: 'Subscriptions' },
          ],
        },
        {
          label: 'Analytics',
          items: [
            { href: '/reports', icon: '📈', label: 'Reports' },
            { href: '/super-admin/audit-logs', icon: '🔍', label: 'Audit Logs' },
          ],
        },
        {
          label: 'System',
          items: [
            { href: '/settings', icon: '⚙️', label: 'Settings' },
            ...common.items,
          ],
        },
      ]

    case 'hospital_admin':
      return [
        {
          label: 'Management',
          items: [
            { href: '/hospital-admin', icon: '📊', label: 'Dashboard' },
            { href: '/staff-directory', icon: '👥', label: 'Staff Directory' },
            { href: '/hospital-admin/pending-registrations', icon: '📋', label: 'Pending Registrations' },
            { href: '/transfers', icon: '🔄', label: 'Transfers' },
          ],
        },
        {
          label: 'Structure',
          items: [
            { href: '/hospital/branches', icon: '🏢', label: 'Branches' },
            { href: '/hospital/departments', icon: '🏬', label: 'Departments' },
            { href: '/hospital/units', icon: '🔲', label: 'Units' },
          ],
        },
        {
          label: 'Competencies',
          items: [
            { href: '/competencies', icon: '📚', label: 'Templates' },
            { href: '/assessments', icon: '✅', label: 'All Assessments' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
            { href: '/renewals', icon: '🔁', label: 'Renewals' },
          ],
        },
        {
          label: 'Admin',
          items: [
            { href: '/reports', icon: '📈', label: 'Reports' },
            { href: '/settings', icon: '⚙️', label: 'Settings' },
            ...common.items,
          ],
        },
      ]

    case 'branch_admin':
      return [
        {
          label: 'Branch',
          items: [
            { href: '/branch-admin', icon: '📊', label: 'Dashboard' },
            { href: '/staff-directory', icon: '👥', label: 'Staff Directory' },
            { href: '/hospital-admin/pending-registrations', icon: '📋', label: 'Pending Registrations' },
          ],
        },
        {
          label: 'Structure',
          items: [
            { href: '/hospital/departments', icon: '🏬', label: 'Departments' },
            { href: '/hospital/units', icon: '🔲', label: 'Units' },
          ],
        },
        {
          label: 'Competencies',
          items: [
            { href: '/assessments', icon: '✅', label: 'Assessments' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
            { href: '/renewals', icon: '🔁', label: 'Renewals' },
          ],
        },
        {
          items: [
            { href: '/reports', icon: '📈', label: 'Reports' },
            ...common.items,
          ],
        },
      ]

    case 'department_head':
      return [
        {
          label: 'Department',
          items: [
            { href: '/department-head', icon: '📊', label: 'Dashboard' },
            { href: '/staff-directory', icon: '👥', label: 'My Staff' },
            { href: '/hospital/units', icon: '🔲', label: 'Units' },
          ],
        },
        {
          label: 'Approvals',
          items: [
            { href: '/head-nurse/approvals', icon: '✍️', label: 'Pending Approvals' },
            { href: '/assessments', icon: '✅', label: 'Assessments' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
          ],
        },
        {
          items: [
            { href: '/reports', icon: '📈', label: 'Reports' },
            ...common.items,
          ],
        },
      ]

    case 'unit_head':
      return [
        {
          label: 'Unit',
          items: [
            { href: '/unit-head', icon: '📊', label: 'Dashboard' },
            { href: '/staff-directory', icon: '👥', label: 'My Staff' },
          ],
        },
        {
          label: 'Approvals',
          items: [
            { href: '/head-nurse/approvals', icon: '✍️', label: 'Pending Approvals' },
            { href: '/assessments', icon: '✅', label: 'Assessments' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
          ],
        },
        {
          items: common.items,
        },
      ]

    case 'head_nurse':
      return [
        {
          label: 'Unit',
          items: [
            { href: '/head-nurse', icon: '📊', label: 'Dashboard' },
            { href: '/staff-directory', icon: '👥', label: 'My Staff' },
            { href: '/assessments', icon: '✅', label: 'Assessments' },
          ],
        },
        {
          label: 'Approvals',
          items: [
            { href: '/head-nurse/approvals', icon: '✍️', label: 'Pending Approvals' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
            { href: '/renewals', icon: '🔁', label: 'Renewals' },
            { href: '/transfers', icon: '🔄', label: 'Transfers' },
          ],
        },
        {
          items: [
            { href: '/reports', icon: '📈', label: 'Reports' },
            ...common.items,
          ],
        },
      ]

    case 'educator':
      return [
        {
          label: 'My Work',
          items: [
            { href: '/educator', icon: '📊', label: 'Dashboard' },
            { href: '/assessor/assigned', icon: '📋', label: 'Assigned Assessments' },
            { href: '/assessor/completed', icon: '✅', label: 'Completed' },
          ],
        },
        {
          label: 'Learning',
          items: [
            { href: '/competencies', icon: '📚', label: 'Competency Templates' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
          ],
        },
        {
          items: common.items,
        },
      ]

    case 'hr_quality':
      return [
        {
          label: 'HR & Quality',
          items: [
            { href: '/hr-quality', icon: '📊', label: 'Dashboard' },
            { href: '/staff-directory', icon: '👥', label: 'Staff Directory' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
            { href: '/renewals', icon: '🔁', label: 'Renewals' },
          ],
        },
        {
          label: 'Approvals',
          items: [
            { href: '/head-nurse/approvals', icon: '✍️', label: 'Pending Approvals' },
            { href: '/reports', icon: '📈', label: 'Reports' },
          ],
        },
        {
          items: common.items,
        },
      ]

    case 'assessor':
      return [
        {
          label: 'My Work',
          items: [
            { href: '/assessor', icon: '📊', label: 'Dashboard' },
            { href: '/assessor/assigned', icon: '📋', label: 'Assigned Assessments' },
            { href: '/assessor/completed', icon: '✅', label: 'Completed' },
          ],
        },
        {
          items: [
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
            ...common.items,
          ],
        },
      ]

    case 'staff':
    default:
      return [
        {
          label: 'My CAMS',
          items: [
            { href: '/staff', icon: '📊', label: 'My Dashboard' },
            { href: '/assessments', icon: '✅', label: 'My Assessments' },
            { href: '/certificates', icon: '🏅', label: 'My Certificates' },
            { href: '/renewals', icon: '🔁', label: 'My Renewals' },
          ],
        },
        {
          items: common.items,
        },
      ]

    case 'auditor':
      return [
        {
          items: [
            { href: '/reports', icon: '📈', label: 'Reports' },
            { href: '/certificates', icon: '🏅', label: 'Certificates' },
            ...common.items,
          ],
        },
      ]
  }
}

interface SidebarProps {
  user: User
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const navSections = getNavConfig(user.role)

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="sidebar-overlay open" onClick={onClose} />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">🏥</div>
          <div className="sidebar-brand">
            <h2>CAMS</h2>
            <p>Competency Management</p>
          </div>
        </div>

        {/* Role pill */}
        <div className="sidebar-role">
          <div className="role-avatar">{getInitials(user.full_name)}</div>
          <div className="role-info">
            <h4>{user.full_name}</h4>
            <p>{getRoleIcon(user.role)} {getRoleLabel(user.role)}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.label && (
                <div className="nav-section-label">{section.label}</div>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge ? (
                      <span className="nav-badge">{item.badge}</span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="sidebar-footer">
          <form action={logout}>
            <button type="submit" className="logout-btn">
              <span className="nav-icon">🚪</span>
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
