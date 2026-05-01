'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from '@/actions/notifications'

interface Notif {
  id: string
  type: string
  category: string | null
  title: string
  body: string
  action_url: string | null
  is_read: boolean
  reference_id: string | null
  reference_type: string | null
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  info: '💬', warning: '⚠️', success: '✅', danger: '🚨',
}
const TYPE_BG: Record<string, string> = {
  info: '#E3F2FD', warning: '#FFF8E1', success: '#E8F5E9', danger: '#FFEBEE',
}
const TYPE_COLOR: Record<string, string> = {
  info: '#1565C0', warning: '#E65100', success: '#2E7D32', danger: '#B71C1C',
}
const CAT_LABEL: Record<string, string> = {
  assessments: 'Assessment', approvals: 'Approval', transfers: 'Transfer',
  certificates: 'Certificate', billing: 'Billing', system: 'System',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-CA')
}

export default function NotificationsClient({ notifications: initial }: { notifications: Notif[] }) {
  const [notifs, setNotifs] = useState(initial)
  const [filter, setFilter] = useState<'all' | 'unread' | string>('all')
  const [isPending, startTransition] = useTransition()

  const unread = notifs.filter((n) => !n.is_read).length

  const filtered = notifs.filter((n) => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'all') return true
    return n.category === filter
  })

  function handleMarkRead(id: string) {
    startTransition(async () => {
      const r = await markNotificationRead(id)
      if (r.success) {
        setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteNotification(id)
      if (r.success) {
        setNotifs((prev) => prev.filter((n) => n.id !== id))
      } else {
        toast.error(r.error ?? 'Failed to delete')
      }
    })
  }

  function handleMarkAll() {
    startTransition(async () => {
      const r = await markAllNotificationsRead()
      if (r.success) {
        setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
        toast.success('All marked as read')
      } else {
        toast.error(r.error ?? 'Failed')
      }
    })
  }

  function handleClearRead() {
    startTransition(async () => {
      const r = await clearReadNotifications()
      if (r.success) {
        setNotifs((prev) => prev.filter((n) => !n.is_read))
        toast.success('Read notifications cleared')
      } else {
        toast.error(r.error ?? 'Failed')
      }
    })
  }

  const categories = ['assessments', 'approvals', 'transfers', 'certificates', 'billing', 'system']
  const hasRead = notifs.some((n) => n.is_read)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Notifications</h1>
          <p>{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        <div className="page-header-actions">
          {unread > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleMarkAll} disabled={isPending}>
              ✓ Mark All Read
            </button>
          )}
          {hasRead && (
            <button className="btn btn-secondary btn-sm" onClick={handleClearRead} disabled={isPending}>
              🗑 Clear Read
            </button>
          )}
          <Link href="/settings/notifications" className="btn btn-secondary btn-sm">
            ⚙️ Preferences
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${notifs.length})` },
          { key: 'unread', label: `Unread (${unread})` },
          ...categories.map((c) => ({
            key: c,
            label: `${CAT_LABEL[c] ?? c} (${notifs.filter((n) => n.category === c).length})`,
          })),
        ].map((tab) => (
          <button
            key={tab.key}
            className={`btn btn-sm ${filter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '16px 20px',
                background: !n.is_read ? 'rgba(30,136,229,0.04)' : 'white',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--gray-100)' : 'none',
                transition: 'background 0.15s',
              }}
              onClick={() => { if (!n.is_read) handleMarkRead(n.id) }}
            >
              {/* Icon */}
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: TYPE_BG[n.type] ?? '#F0F4F8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, marginTop: 1,
              }}>
                {TYPE_ICON[n.type] ?? '💬'}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--navy)' }}>
                      {n.title}
                    </span>
                    {n.category && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 4,
                        background: TYPE_BG[n.type] ?? '#F0F4F8',
                        color: TYPE_COLOR[n.type] ?? '#3D5166',
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {CAT_LABEL[n.category] ?? n.category}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)', flexShrink: 0 }}>
                    {timeAgo(n.created_at)}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 3, lineHeight: 1.55 }}>
                  {n.body}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  {n.action_url && (
                    <Link
                      href={n.action_url}
                      style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      View details →
                    </Link>
                  )}
                  {!n.is_read && (
                    <button
                      style={{ fontSize: 11, color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id) }}
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    style={{ fontSize: 11, color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(n.id) }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Unread dot */}
              {!n.is_read && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 8 }} />
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
              <p style={{ fontSize: 14 }}>
                {filter === 'unread' ? 'No unread notifications' :
                 filter === 'all' ? 'No notifications yet' :
                 `No ${CAT_LABEL[filter] ?? filter} notifications`}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
