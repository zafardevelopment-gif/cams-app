import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications — CAMS' }

const typeIcon: Record<string, string> = { info: '💬', warning: '⚠️', success: '✅', danger: '🚨' }
const typeBg: Record<string, string> = { info: '#E3F2FD', warning: '#FFF8E1', success: '#E8F5E9', danger: '#FFEBEE' }

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: notifications } = await admin
    .from(T.notifications)
    .select('id, type, title, body, action_url, is_read, created_at')
    .eq('user_id', authUser!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const list = notifications ?? []
  const unread = list.filter((n) => !n.is_read).length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Notifications</h1>
          <p>{unread} unread notifications</p>
        </div>
        <div className="page-header-actions">
          {unread > 0 && <button className="btn btn-secondary btn-sm">✓ Mark All Read</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {list.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '16px 20px',
                background: !n.is_read ? 'rgba(30,136,229,0.04)' : 'white',
                borderBottom: i < list.length - 1 ? '1px solid var(--gray-100)' : 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: typeBg[n.type] ?? '#F0F4F8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginTop: 1,
              }}>
                {typeIcon[n.type] ?? '💬'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--navy)' }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--gray-500)', flexShrink: 0, marginLeft: 12 }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3, lineHeight: 1.5 }}>{n.body}</p>
                {n.action_url && (
                  <a href={n.action_url} style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, marginTop: 6, display: 'inline-block' }}>
                    View details →
                  </a>
                )}
              </div>
              {!n.is_read && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 6 }} />
              )}
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
              <p>No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
