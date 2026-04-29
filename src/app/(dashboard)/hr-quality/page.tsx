import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { getHrQualityDashboardData } from '@/actions/reports'
import HrQualityCharts from './HrQualityCharts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'HR / Quality Dashboard — CAMS' }

export default async function HrQualityPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('hospital_id, full_name')
    .eq('id', authUser!.id)
    .single()

  const dashData = await getHrQualityDashboardData(profile?.hospital_id ?? '')

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>HR / Quality Dashboard</h1>
          <p>Compliance and quality overview</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary btn-sm">📥 Reports</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '👥', label: 'Active Staff', value: dashData.activeStaff, bg: '#E3F2FD' },
          { icon: '📊', label: 'Compliance Rate', value: `${dashData.complianceRate}%`, bg: dashData.complianceRate >= 70 ? '#E8F5E9' : '#FFEBEE' },
          { icon: '🏅', label: 'Active Certs', value: dashData.activeCerts, bg: '#E8F5E9' },
          { icon: '⚠️', label: 'Expiring Certs', value: dashData.expiringCerts, bg: '#FFF8E1', alert: dashData.expiringCerts > 0 },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 12 }}>
        {[
          { icon: '🔁', label: 'Overdue Renewals', value: dashData.overdueRenewals, bg: '#FFEBEE', alert: dashData.overdueRenewals > 0 },
          { icon: '🔄', label: 'Pending Transfers', value: dashData.pendingTransfers, bg: '#F3E5F5' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Overdue</div>}
          </div>
        ))}
      </div>

      <HrQualityCharts
        deptCompliance={dashData.deptCompliance}
        trend={dashData.trend}
        complianceRate={dashData.complianceRate}
      />

      <div className="grid-4" style={{ marginTop: 24 }}>
        {[
          { href: '/staff-directory', icon: '👥', title: 'Staff Directory' },
          { href: '/certificates', icon: '🏅', title: 'Certificates' },
          { href: '/renewals', icon: '🔁', title: 'Renewals' },
          { href: '/head-nurse/approvals', icon: '✍️', title: 'Pending Approvals' },
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
