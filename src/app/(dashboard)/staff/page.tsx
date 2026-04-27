import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Dashboard — CAMS' }

const STATUS_BADGE: Record<string, string> = {
  passed: 'badge-green', in_progress: 'badge-yellow', not_started: 'badge-gray',
  active: 'badge-green', expiring_soon: 'badge-yellow', expired: 'badge-red',
  assessor_review: 'badge-blue', submitted: 'badge-purple', head_nurse_review: 'badge-teal',
}
const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed', in_progress: 'In Progress', not_started: 'Not Started',
  active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired',
  assessor_review: 'Assessor Review', submitted: 'Submitted', head_nurse_review: 'HN Review',
}

export default async function StaffDashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('full_name, job_title').eq('id', authUser!.id).single()

  const [{ data: myAssessments }, { data: myCerts }] = await Promise.all([
    admin.from(T.assessments)
      .select(`id, status, overall_score, template:${J.competency_templates}!template_id(title, category)`)
      .eq('staff_id', authUser!.id)
      .order('created_at', { ascending: false }),
    admin.from(T.certificates)
      .select(`id, status, expiry_date, template:${J.competency_templates}!template_id(title)`)
      .eq('staff_id', authUser!.id)
      .order('expiry_date'),
  ])

  const assessments = myAssessments ?? []
  const certs = myCerts ?? []

  const passedCount = assessments.filter((a) => a.status === 'passed').length
  const activeCerts = certs.filter((c) => c.status === 'active').length
  const expiringCerts = certs.filter((c) => c.status === 'expiring_soon').length
  const complianceRate = assessments.length > 0 ? Math.round((passedCount / assessments.length) * 100) : 0

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg,#0B1F3A 0%,#1565C0 60%,#0288D1 100%)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/svg%3E")` }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Good day</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>{profile?.full_name ?? 'My Competency Dashboard'}</h2>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{profile?.job_title ?? 'Track your assessments, certificates & renewals'}</div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            {[
              { value: assessments.length, label: 'Assessments' },
              { value: `${complianceRate}%`, label: 'Compliant' },
              { value: activeCerts, label: 'Certificates' },
            ].map((stat) => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '7px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', textAlign: 'right' }}>
          <div style={{ width: 100, height: 100, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, margin: '0 auto 10px' }}>👩‍⚕️</div>
          <span style={{ background: 'rgba(76,175,80,0.3)', border: '1px solid rgba(76,175,80,0.5)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#A5D6A7', fontWeight: 600 }}>
            ● {complianceRate}% Compliant
          </span>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>📚</div>
          <div className="kpi-label">Total Assessments</div>
          <div className="kpi-value">{assessments.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>✅</div>
          <div className="kpi-label">Passed</div>
          <div className="kpi-value">{passedCount}</div>
          <div className="kpi-change up">of {assessments.length} total</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E0F2F1' }}>🏅</div>
          <div className="kpi-label">Active Certificates</div>
          <div className="kpi-value">{activeCerts}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFF8E1' }}>⚠️</div>
          <div className="kpi-label">Expiring Soon</div>
          <div className="kpi-value">{expiringCerts}</div>
          {expiringCerts > 0 && <div className="kpi-change down">Action needed</div>}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">My Assessments</div>
              <div className="card-subtitle">All assigned competencies</div>
            </div>
            <Link href="/assessments" className="btn btn-primary btn-sm">View All</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Competency</th><th>Category</th><th>Status</th><th>Score</th></tr>
                </thead>
                <tbody>
                  {assessments.slice(0, 5).map((a) => {
                    const templateRaw = a.template as unknown
                    const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string; category: string } | null
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/assessments/${a.id}`} style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}>
                            {template?.title ?? '—'}
                          </Link>
                        </td>
                        <td><span className="text-muted text-sm">{template?.category ?? '—'}</span></td>
                        <td><span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                        <td>{a.overall_score != null ? `${a.overall_score}%` : '—'}</td>
                      </tr>
                    )
                  })}
                  {assessments.length === 0 && (
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
              <div className="card-title">My Certificates</div>
              <div className="card-subtitle">{activeCerts} active</div>
            </div>
            <Link href="/certificates" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Competency</th><th>Status</th><th>Expires</th></tr>
                </thead>
                <tbody>
                  {certs.map((c) => {
                    const templateRaw = c.template as unknown
                    const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string } | null
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{template?.title ?? '—'}</td>
                        <td><span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-gray'}`}>{STATUS_LABEL[c.status] ?? c.status}</span></td>
                        <td><span style={{ fontSize: 12 }}>{c.expiry_date}</span></td>
                      </tr>
                    )
                  })}
                  {certs.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No certificates yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
