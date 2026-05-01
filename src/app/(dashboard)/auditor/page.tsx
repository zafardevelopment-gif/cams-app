import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { T } from '@/lib/db'
import { getAuditorDashboardData } from '@/actions/reports'
import {
  PassFailPie,
  ComplianceBar,
  PassFailTrend,
} from '@/components/charts/Charts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Auditor Dashboard — CAMS' }

export default async function AuditorPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('role, hospital_id, full_name')
    .eq('id', authUser.id)
    .single()

  if (!profile || profile.role !== 'auditor') redirect('/login')

  const { data: hospital } = await admin
    .from(T.hospitals)
    .select('name')
    .eq('id', profile.hospital_id!)
    .single()

  const dash = await getAuditorDashboardData(profile.hospital_id ?? '')

  const compRate = dash.complianceRate
  const compColor = compRate >= 80 ? 'var(--green)' : compRate >= 60 ? '#F57F17' : 'var(--red)'

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Auditor Dashboard</h1>
          <p>{hospital?.name ?? 'Hospital'} · Compliance overview</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary btn-sm">📥 Full Reports</Link>
          <Link href="/certificates" className="btn btn-secondary btn-sm">🏅 Certificates</Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>👥</div>
          <div className="kpi-label">Active Staff</div>
          <div className="kpi-value">{dash.totalStaff}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: compRate >= 70 ? '#E8F5E9' : '#FFEBEE' }}>📊</div>
          <div className="kpi-label">Compliance Rate</div>
          <div className="kpi-value" style={{ color: compColor }}>{compRate}%</div>
          <div className="kpi-change" style={{ color: compColor }}>
            {compRate >= 80 ? 'On target' : compRate >= 60 ? 'Needs attention' : 'Below target'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>🏅</div>
          <div className="kpi-label">Active Certs</div>
          <div className="kpi-value">{dash.activeCerts}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFF8E1' }}>⚠️</div>
          <div className="kpi-label">Expiring Soon</div>
          <div className="kpi-value" style={{ color: dash.expiringSoon > 0 ? '#F57F17' : 'inherit' }}>{dash.expiringSoon}</div>
          {dash.expiringSoon > 0 && <div className="kpi-change down">Within 60 days</div>}
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFEBEE' }}>❌</div>
          <div className="kpi-label">Expired Certs</div>
          <div className="kpi-value" style={{ color: dash.expiredCount > 0 ? 'var(--red)' : 'inherit' }}>{dash.expiredCount}</div>
          {dash.expiredCount > 0 && <div className="kpi-change down">Action required</div>}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Pass/Fail distribution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Assessment Results</div>
            <div className="card-subtitle">{dash.totalAssessments} total assessments</div>
          </div>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              <PassFailPie passed={dash.passed} failed={dash.failed} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                <div className="kpi-card" style={{ padding: '10px 14px' }}>
                  <div className="kpi-label">Passed</div>
                  <div className="kpi-value" style={{ fontSize: 22, color: 'var(--green)' }}>{dash.passed}</div>
                </div>
                <div className="kpi-card" style={{ padding: '10px 14px' }}>
                  <div className="kpi-label">Failed</div>
                  <div className="kpi-value" style={{ fontSize: 22, color: 'var(--red)' }}>{dash.failed}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6-month trend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">6-Month Trend</div>
            <div className="card-subtitle">Pass / fail over time</div>
          </div>
          <div className="card-body">
            <PassFailTrend data={dash.trend} />
          </div>
        </div>
      </div>

      {/* Branch & Dept compliance */}
      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {dash.branchCompliance.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Branch Compliance</div>
            </div>
            <div className="card-body">
              <ComplianceBar
                data={dash.branchCompliance.map((b) => ({ name: b.name, compliance: b.compliance }))}
                label="Compliance %"
              />
            </div>
          </div>
        )}

        {dash.deptCompliance.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Department Compliance</div>
            </div>
            <div className="card-body">
              <ComplianceBar
                data={dash.deptCompliance.map((d) => ({ name: d.name, compliance: d.compliance }))}
                label="Compliance %"
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Audit Reports</div>
          <div className="card-subtitle">Quick access to compliance data</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { href: '/reports?type=competency_matrix', icon: '📋', label: 'Competency Matrix', desc: 'Full staff competency status' },
              { href: '/reports?type=pass_fail', icon: '✅', label: 'Pass / Fail Report', desc: 'All assessment outcomes' },
              { href: '/reports?type=cert_expiry', icon: '🏅', label: 'Certificate Expiry', desc: 'Active, expiring & expired' },
              { href: '/reports?type=branch_comparison', icon: '🏢', label: 'Branch Comparison', desc: 'Compliance across branches' },
              { href: '/renewals', icon: '🔄', label: 'Renewals', desc: 'Overdue & upcoming renewals' },
              { href: '/transfers', icon: '↔️', label: 'Transfers', desc: 'Staff transfer history' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'block', padding: '14px 16px', border: '1px solid var(--border)',
                  borderRadius: 10, textDecoration: 'none', transition: 'box-shadow 0.15s',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 13, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
