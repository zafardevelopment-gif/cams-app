import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import AuditLogsClient from './AuditLogsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Audit Logs — CAMS' }

export default async function AuditLogsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') redirect('/login')

  const { data: logs } = await admin
    .from(T.activity_logs)
    .select(`id, action, entity_type, entity_id, description, created_at, user:${J.users}!user_id(full_name, email, role)`)
    .order('created_at', { ascending: false })
    .limit(500)

  const list = (logs ?? []).map((l) => ({
    ...l,
    user: l.user ? (Array.isArray(l.user) ? l.user[0] : l.user) : null,
  }))

  const todayCount = list.filter((l) => {
    const d = new Date(l.created_at)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).length

  const loginCount = list.filter((l) => l.action === 'user_login').length
  const errorCount = list.filter((l) => ['reject_approval', 'reject_registration', 'delete_user', 'delete_hospital'].includes(l.action)).length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Audit Logs</h1>
          <p>Platform-wide activity trail · Last 500 entries</p>
        </div>
        <div className="page-header-actions">
          <Link href="/super-admin" className="btn btn-secondary btn-sm">← Overview</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>📋</div>
          <div className="kpi-label">Total Entries</div>
          <div className="kpi-value">{list.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>📅</div>
          <div className="kpi-label">Today</div>
          <div className="kpi-value">{todayCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E0F2F1' }}>🔑</div>
          <div className="kpi-label">Logins</div>
          <div className="kpi-value">{loginCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFEBEE' }}>⚠️</div>
          <div className="kpi-label">Deletions / Rejections</div>
          <div className="kpi-value" style={{ color: errorCount > 0 ? 'var(--red)' : 'inherit' }}>{errorCount}</div>
        </div>
      </div>

      <AuditLogsClient logs={list} />
    </>
  )
}
