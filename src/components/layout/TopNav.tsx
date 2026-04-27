'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getInitials, getRoleLabel } from '@/lib/utils'
import type { User } from '@/types'
import { logout } from '@/actions/auth'

interface TopNavProps {
  user: User
  breadcrumb?: { label: string; href?: string }[]
  onMenuClick?: () => void
}

export function TopNav({ user, breadcrumb, onMenuClick }: TopNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="topnav">
      {/* Mobile menu button — visible on mobile via CSS */}
      <button
        className="topnav-btn mobile-menu-btn"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        ☰
      </button>

      {/* Breadcrumb */}
      <div className="topnav-breadcrumb">
        <span>CAMS</span>
        {breadcrumb?.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="sep">/</span>
            {crumb.href ? (
              <Link href={crumb.href} style={{ color: 'var(--gray-500)', textDecoration: 'none' }}>
                {crumb.label}
              </Link>
            ) : (
              <span className="current">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Search — hidden on mobile via CSS */}
      <div className="topnav-search">
        <span>🔍</span>
        <input placeholder="Search staff, assessments..." />
      </div>

      {/* Actions */}
      <div className="topnav-actions">
        <Link href="/notifications" className="topnav-btn" style={{ textDecoration: 'none' }}>
          🔔
          <div className="notif-dot" />
        </Link>

        {/* User dropdown */}
        <div className="dropdown" ref={dropdownRef}>
          <button
            className="user-pill"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div className="user-avatar">{getInitials(user.full_name)}</div>
            <div className="topnav-user-info">
              <div className="user-name">{user.full_name}</div>
              <div className="user-role-tag">{getRoleLabel(user.role)}</div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>▼</span>
          </button>

          {dropdownOpen && (
            <div className="dropdown-menu" style={{ display: 'flex' }}>
              <Link
                href="/settings"
                className="dropdown-item"
                onClick={() => setDropdownOpen(false)}
              >
                ⚙️ Settings
              </Link>
              <div style={{ height: 1, background: 'var(--gray-100)', margin: '4px 0' }} />
              <form action={logout}>
                <button
                  type="submit"
                  className="dropdown-item danger"
                  style={{ width: '100%', border: 'none', background: 'none', fontFamily: 'inherit' }}
                >
                  🚪 Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
