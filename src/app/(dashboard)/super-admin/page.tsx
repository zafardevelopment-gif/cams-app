import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import SuperAdminCharts from './SuperAdminCharts'
import { getSuperAdminDashboardData } from '@/actions/reports'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Platform Overview — CAMS' }

export default async function SuperAdminPage() {
  const admin = createAdminClient()

  const [{ data: hospitals }, { data: registrations }, dashData] = await Promise.all([
    admin.from(T.hospitals).select('id, name, city, region, subscription_plan, cbahi_accredited, is_active').order('created_at'),
    admin.from(T.registration_requests).select('id, full_name, email, job_title, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    getSuperAdminDashboardData(),
  ])

  const activeHospitals = (hospitals ?? []).filter((h) => h.is_active)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Platform Overview</h1>
          <p>All hospitals · Live data</p>
        </div>
        <div className="page-header-actions">
          <Link href="/super-admin/users" className="btn btn-secondary btn-sm">👥 Users</Link>
          <Link href="/reports" className="btn btn-secondary btn-sm">📥 Reports</Link>
          <Link href="/super-admin/hospitals" className="btn btn-primary btn-sm">＋ Add Hospital</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>🏥</div>
          <div className="kpi-label">Total Hospitals</div>
          <div className="kpi-value">{dashData.totalHospitals}</div>
          <div className="kpi-change up">{activeHospitals.length} active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>👥</div>
          <div className="kpi-label">Total Users</div>
          <div className="kpi-value">{dashData.totalUsers}</div>
          <div className="kpi-change up">{dashData.activeUsers} active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E0F2F1' }}>✅</div>
          <div className="kpi-label">Active Subscriptions</div>
          <div className="kpi-value">{dashData.activeSubscriptions}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFF8E1' }}>💰</div>
          <div className="kpi-label">Revenue</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>—</div>
          <div className="kpi-change" style={{ color: 'var(--gray-400)' }}>Billing pending</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#F3E5F5' }}>📋</div>
          <div className="kpi-label">Pending Regs</div>
          <div className="kpi-value">{(registrations ?? []).length}</div>
          {(registrations ?? []).length > 0 && <div className="kpi-change down">Needs review</div>}
        </div>
      </div>

      {/* Charts row */}
      <SuperAdminCharts
        monthlyUsers={dashData.monthlyUsers}
        monthlyAssessments={dashData.monthlyAssessments}
      />

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Hospital Accounts</div>
              <div className="card-subtitle">{activeHospitals.length} active subscriptions</div>
            </div>
            <Link href="/super-admin/hospitals" className="btn btn-primary btn-sm">Manage</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Region</th>
                    <th>Plan</th>
                    <th>CBAHI</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(hospitals ?? []).slice(0, 6).map((h) => (
                    <tr key={h.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg, var(--blue), var(--teal))' }}>🏥</div>
                          <div>
                            <h4>{h.name}</h4>
                            <p>{h.city}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="text-sm text-muted">{h.region ?? '—'}</span></td>
                      <td><span className="badge badge-blue">{h.subscription_plan}</span></td>
                      <td>{h.cbahi_accredited ? '✅' : '—'}</td>
                      <td>
                        <Link href="/super-admin/hospitals" className="btn btn-secondary btn-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                  {(hospitals ?? []).length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No hospitals yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Activity</div>
              <div className="card-subtitle">Platform-wide events</div>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Event</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {(dashData.recentActivity ?? []).map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 500 }}>{log.action.replace(/_/g, ' ')}</td>
                      <td className="text-sm text-muted">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(dashData.recentActivity ?? []).length === 0 && (
                    <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No recent activity</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Pending registrations */}
      {(registrations ?? []).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Pending Registrations</div>
              <div className="card-subtitle">{(registrations ?? []).length} awaiting review</div>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {(registrations ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                      <td className="text-muted text-sm">{r.email}</td>
                      <td><span className="badge badge-gray">{r.job_title ?? '—'}</span></td>
                      <td className="text-sm text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <Link href="/hospital-admin/pending-registrations" className="btn btn-secondary btn-sm">Review</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid-4">
        {[
          { href: '/super-admin/hospitals', icon: '🏥', title: 'Manage Hospitals', sub: 'Add, edit, suspend hospital accounts' },
          { href: '/super-admin/users', icon: '👥', title: 'All Users', sub: 'View and manage all platform users' },
          { href: '/reports', icon: '📊', title: 'Platform Reports', sub: 'Export and analyze compliance data' },
          { href: '/settings', icon: '⚙️', title: 'Platform Settings', sub: 'Email templates, branding, config' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: 18, cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>{item.title}</div>
              <div className="text-muted text-sm">{item.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
