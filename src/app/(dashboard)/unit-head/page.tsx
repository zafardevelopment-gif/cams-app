import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { getUnitHeadDashboardData } from '@/actions/reports'
import UnitHeadCharts from './UnitHeadCharts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Unit Head Dashboard — CAMS' }

export default async function UnitHeadPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('hospital_id, unit_id, full_name')
    .eq('id', authUser!.id)
    .single()

  const dashData = await getUnitHeadDashboardData(profile?.unit_id ?? '', authUser!.id)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Unit Dashboard</h1>
          <p>Overview for your unit</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary btn-sm">📥 Reports</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '👥', label: 'Unit Staff', value: dashData.teamSize, bg: '#E3F2FD' },
          { icon: '📋', label: 'Pending Assessments', value: dashData.pendingAssessments, bg: '#FFF3E0' },
          { icon: '📊', label: 'Pass Rate', value: `${dashData.passRate}%`, bg: dashData.passRate >= 70 ? '#E8F5E9' : '#FFEBEE' },
          { icon: '✍️', label: 'Approvals Needed', value: dashData.approvalsNeeded, bg: '#F3E5F5', alert: dashData.approvalsNeeded > 0 },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <UnitHeadCharts
        trend={dashData.trend}
        passed={dashData.passed}
        failed={dashData.failed}
        pending={dashData.pendingAssessments}
      />

      <div className="grid-4" style={{ marginTop: 24 }}>
        {[
          { href: '/staff-directory', icon: '👥', title: 'My Staff' },
          { href: '/head-nurse/approvals', icon: '✍️', title: 'Pending Approvals' },
          { href: '/assessments', icon: '✅', title: 'Assessments' },
          { href: '/certificates', icon: '🏅', title: 'Certificates' },
          { href: '/reports', icon: '📈', title: 'Reports' },
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
