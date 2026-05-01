import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'All Users — CAMS' }

export default async function SuperAdminUsersPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') redirect('/login')

  const [{ data: users }, { data: hospitals }] = await Promise.all([
    admin
      .from(T.users)
      .select(`id, full_name, email, role, status, job_title, created_at, hospital:${J.hospitals}!hospital_id(name)`)
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from(T.hospitals)
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  const list = users ?? []
  const activeCount = list.filter((u) => u.status === 'active').length
  const hospitalAdmins = list.filter((u) => u.role === 'hospital_admin').length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>All Users</h1>
          <p>Platform-wide user accounts</p>
        </div>
        <div className="page-header-actions">
          <Link href="/super-admin" className="btn btn-secondary btn-sm">← Overview</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>👥</div>
          <div className="kpi-label">Total Users</div>
          <div className="kpi-value">{list.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>✅</div>
          <div className="kpi-label">Active</div>
          <div className="kpi-value">{activeCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E0F2F1' }}>🏥</div>
          <div className="kpi-label">Hospital Admins</div>
          <div className="kpi-value">{hospitalAdmins}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#F3E5F5' }}>🏢</div>
          <div className="kpi-label">Hospitals</div>
          <div className="kpi-value">{(hospitals ?? []).length}</div>
        </div>
      </div>

      <UsersClient
        users={list as Parameters<typeof UsersClient>[0]['users']}
        hospitals={hospitals ?? []}
      />
    </>
  )
}
