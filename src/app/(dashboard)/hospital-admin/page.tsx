import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { getHospitalAdminDashboardData } from '@/actions/reports'
import HospitalAdminCharts from './HospitalAdminCharts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hospital Admin Dashboard — CAMS' }

const STATUS_BADGE: Record<string, string> = {
  passed: 'badge-green', assessor_review: 'badge-blue', in_progress: 'badge-yellow', submitted: 'badge-purple',
  head_nurse_review: 'badge-teal', failed: 'badge-red', not_started: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed', assessor_review: 'Assessor Review', in_progress: 'In Progress', submitted: 'Submitted',
  head_nurse_review: 'HN Review', failed: 'Failed', not_started: 'Not Started',
}

export default async function HospitalAdminPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('hospital_id').eq('id', authUser!.id).single()
  const hospitalId = profile?.hospital_id ?? ''

  const [{ data: recentAssessments }, { data: pendingRegs }, dashData] = await Promise.all([
    admin.from(T.assessments)
      .select(`id, status, created_at, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title)`)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })
      .limit(5),
    admin.from(T.registration_requests)
      .select('id, full_name, email, job_title, created_at')
      .eq('hospital_id', hospitalId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    getHospitalAdminDashboardData(hospitalId),
  ])

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Hospital Dashboard</h1>
          <p>Overview of staff competencies and compliance</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary btn-sm">📥 Reports</Link>
          <Link href="/competencies" className="btn btn-primary btn-sm">＋ New Competency</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { icon: '👥', label: 'Total Staff', value: dashData.totalStaff, bg: '#E3F2FD' },
          { icon: '📋', label: 'Pending Approvals', value: dashData.pendingApprovals, bg: '#F3E5F5', alert: dashData.pendingApprovals > 0 },
          { icon: '✅', label: 'Active Assessments', value: dashData.activeAssessments, bg: '#E8F5E9' },
          { icon: '📊', label: 'Pass Rate', value: `${dashData.passRate}%`, bg: '#E0F2F1', sub: `${dashData.passed}/${dashData.totalAssessments}` },
          { icon: '⚠️', label: 'Expiring Licenses', value: dashData.expiringLicenses, bg: '#FFEBEE', alert: dashData.expiringLicenses > 0 },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.sub && <div className="kpi-change up">{k.sub} assessments</div>}
            {k.alert && !k.sub && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 12 }}>
        {[
          { icon: '🏅', label: 'Active Certs', value: dashData.activeCerts, bg: '#E8F5E9' },
          { icon: '🔔', label: 'Expiring Certs', value: dashData.expiringCerts, bg: '#FFF8E1', alert: dashData.expiringCerts > 0 },
          { icon: '🔄', label: 'Pending Transfers', value: dashData.pendingTransfers, bg: '#F3E5F5' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Need renewal</div>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <HospitalAdminCharts
        passFailTrend={dashData.passFailTrend}
        deptCompliance={dashData.deptCompliance}
        passed={dashData.passed}
        failed={dashData.failed}
        pending={dashData.activeAssessments}
      />

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Assessments</div>
              <div className="card-subtitle">Across all departments</div>
            </div>
            <Link href="/assessments" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Staff</th><th>Competency</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {(recentAssessments ?? []).map((a) => {
                    const staffRaw = a.staff as unknown
                    const templateRaw = a.template as unknown
                    const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw as { full_name: string; job_title: string } | null
                    const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string } | null
                    return (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{staff?.full_name ?? '—'}</td>
                        <td className="text-sm text-muted">{template?.title ?? '—'}</td>
                        <td><span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                        <td className="text-sm text-muted">{new Date(a.created_at).toLocaleDateString()}</td>
                      </tr>
                    )
                  })}
                  {(recentAssessments ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No assessments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Pending Registrations</div>
              <div className="card-subtitle">{(pendingRegs ?? []).length} awaiting review</div>
            </div>
            <Link href="/hospital-admin/pending-registrations" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Date</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {(pendingRegs ?? []).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                        <div className="text-xs text-muted">{r.email}</div>
                      </td>
                      <td><span className="badge badge-gray">{r.job_title}</span></td>
                      <td className="text-sm text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <Link href="/hospital-admin/pending-registrations" className="btn btn-primary btn-sm">Review</Link>
                      </td>
                    </tr>
                  ))}
                  {(pendingRegs ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No pending registrations</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-4">
        {[
          { href: '/staff-directory', icon: '👥', title: 'Staff Directory' },
          { href: '/hospital/branches', icon: '🏢', title: 'Branches' },
          { href: '/hospital/departments', icon: '🏬', title: 'Departments' },
          { href: '/hospital/units', icon: '🔲', title: 'Units' },
          { href: '/competencies', icon: '📚', title: 'Competency Templates' },
          { href: '/transfers', icon: '🔄', title: 'Staff Transfers' },
          { href: '/reports', icon: '📈', title: 'Reports' },
          { href: '/settings', icon: '⚙️', title: 'Hospital Settings' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: 18, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{item.title}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
