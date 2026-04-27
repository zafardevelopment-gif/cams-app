import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import ReportExporter from '@/components/reports/ReportExporter'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports — CAMS' }

const reportCards = [
  { icon: '👥', title: 'Staff Overview', desc: 'Staff by role, department, status breakdown', color: '#E3F2FD' },
  { icon: '✅', title: 'Competency Completion', desc: 'Assessment pass/fail rates by department', color: '#E8F5E9' },
  { icon: '🏅', title: 'Certificate Report', desc: 'Active, expiring, and expired certificates', color: '#E0F2F1' },
  { icon: '🔁', title: 'Renewal Report', desc: 'Upcoming and overdue renewals', color: '#FFF8E1' },
  { icon: '📊', title: 'Compliance Report', desc: 'Overall compliance rate by unit', color: '#F3E5F5' },
  { icon: '📋', title: 'Assessor Performance', desc: 'Assessment count and turnaround time', color: '#E8EAF6' },
]

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()
  const hospitalId = profile?.hospital_id

  const [{ data: staffRows }, { data: assessmentRows }, { data: certRows }] = await Promise.all([
    admin.from(T.users).select('id').eq('hospital_id', hospitalId ?? '').eq('status', 'active'),
    admin.from(T.assessments).select('id, status').eq('hospital_id', hospitalId ?? ''),
    admin.from(T.certificates).select('id, status').eq('hospital_id', hospitalId ?? ''),
  ])

  const totalStaff = (staffRows ?? []).length
  const totalAssessments = (assessmentRows ?? []).length
  const passedAssessments = (assessmentRows ?? []).filter((a) => a.status === 'passed').length
  const failedAssessments = (assessmentRows ?? []).filter((a) => a.status === 'failed').length
  const activeCerts = (certRows ?? []).filter((c) => c.status === 'active').length
  const expiredCerts = (certRows ?? []).filter((c) => c.status === 'expired').length
  const expiringCerts = (certRows ?? []).filter((c) => c.status === 'expiring_soon').length
  const passRate = totalAssessments > 0 ? Math.round((passedAssessments / totalAssessments) * 100) : 0

  const stats = { totalStaff, totalAssessments, passedAssessments, failedAssessments, activeCerts, expiredCerts, expiringCerts, passRate, hospitalName: '' }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Reports & Analytics</h1>
          <p>Generate and export compliance reports</p>
        </div>
        <div className="page-header-actions">
          <ReportExporter stats={stats} />
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 28 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>👥</div>
          <div className="kpi-label">Active Staff</div>
          <div className="kpi-value">{totalStaff}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>📊</div>
          <div className="kpi-label">Pass Rate</div>
          <div className="kpi-value">{passRate}%</div>
          <div className="kpi-change up">{passedAssessments} / {totalAssessments} passed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E0F2F1' }}>🏅</div>
          <div className="kpi-label">Active Certificates</div>
          <div className="kpi-value">{activeCerts}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFEBEE' }}>⚠️</div>
          <div className="kpi-label">Expiring Certs</div>
          <div className="kpi-value">{expiringCerts}</div>
          {expiringCerts > 0 && <div className="kpi-change down">Need renewal</div>}
        </div>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
        Available Reports
      </h3>
      <div className="grid-3" style={{ marginBottom: 28 }}>
        {reportCards.map((r) => (
          <div key={r.title} className="card" style={{ padding: 20, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {r.icon}
              </div>
              <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 14 }}>{r.title}</div>
            </div>
            <p className="text-muted text-sm" style={{ lineHeight: 1.6, marginBottom: 14 }}>{r.desc}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm">📊 View</button>
              <button className="btn btn-secondary btn-sm">📥 Excel</button>
              <button className="btn btn-secondary btn-sm">📄 PDF</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Assessment Summary</div>
        </div>
        <div className="card-body p-0">
          <table>
            <thead>
              <tr><th>Metric</th><th>Count</th><th>% of Total</th><th>Trend</th></tr>
            </thead>
            <tbody>
              <tr><td>Total Assessments</td><td style={{ fontWeight: 700 }}>{totalAssessments}</td><td>100%</td><td>—</td></tr>
              <tr><td>Passed</td><td style={{ fontWeight: 700, color: 'var(--green)' }}>{passedAssessments}</td><td>{passRate}%</td><td className="text-green">↑</td></tr>
              <tr><td>Failed</td><td style={{ fontWeight: 700, color: 'var(--red)' }}>{failedAssessments}</td><td>{totalAssessments > 0 ? 100 - passRate : 0}%</td><td className="text-red">↓</td></tr>
              <tr><td>Active Certificates</td><td style={{ fontWeight: 700 }}>{activeCerts}</td><td>—</td><td>—</td></tr>
              <tr><td>Expired Certificates</td><td style={{ fontWeight: 700, color: 'var(--red)' }}>{expiredCerts}</td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
