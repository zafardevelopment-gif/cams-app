import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { getEducatorDashboardData } from '@/actions/reports'
import EducatorCharts from './EducatorCharts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Educator Dashboard — CAMS' }

export default async function EducatorPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('hospital_id, full_name')
    .eq('id', authUser!.id)
    .single()

  const dashData = await getEducatorDashboardData(profile?.hospital_id ?? '', authUser!.id)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Educator Dashboard</h1>
          <p>Your assessment and training overview</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary btn-sm">📥 Reports</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '📚', label: 'Active Templates', value: dashData.activeTemplates, bg: '#E8F5E9', sub: `${dashData.totalTemplates} total` },
          { icon: '📊', label: 'Training Completion', value: `${dashData.completionRate}%`, bg: '#E3F2FD' },
          { icon: '❌', label: 'Failed Staff', value: dashData.failedStaffCount, bg: '#FFEBEE', alert: dashData.failedStaffCount > 0 },
          { icon: '📋', label: 'Pending Evals', value: dashData.pendingEvals, bg: '#FFF3E0', alert: dashData.pendingEvals > 0 },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.sub && <div className="kpi-change up">{k.sub}</div>}
            {k.alert && !k.sub && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <EducatorCharts
        categoryData={dashData.categoryData}
        trend={dashData.trend}
        completionRate={dashData.completionRate}
      />

      <div className="grid-4" style={{ marginTop: 24 }}>
        {[
          { href: '/assessments', icon: '📋', title: 'Assigned Assessments' },
          { href: '/competencies', icon: '📚', title: 'Templates' },
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
