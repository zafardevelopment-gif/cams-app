import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { getBranchAdminDashboardData } from '@/actions/reports'
import BranchAdminCharts from './BranchAdminCharts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Branch Admin Dashboard — CAMS' }

export default async function BranchAdminPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('hospital_id, branch_id, full_name')
    .eq('id', authUser!.id)
    .single()

  const hospitalId = profile?.hospital_id ?? ''
  const branchId = profile?.branch_id ?? ''

  const dashData = await getBranchAdminDashboardData(hospitalId, branchId)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Branch Dashboard</h1>
          <p>Overview for your branch</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary btn-sm">📥 Reports</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '👥', label: 'Branch Staff', value: dashData.branchStaff, bg: '#E3F2FD' },
          { icon: '📊', label: 'Branch Compliance', value: `${dashData.branchCompliance}%`, bg: dashData.branchCompliance >= 70 ? '#E8F5E9' : '#FFEBEE' },
          { icon: '✅', label: 'Active Assessments', value: dashData.activeAssessments, bg: '#E0F2F1' },
          { icon: '📋', label: 'Pending Actions', value: dashData.pendingActions, bg: '#F3E5F5', alert: dashData.pendingActions > 0 },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <BranchAdminCharts
        deptBreakdown={dashData.deptBreakdown}
        monthlyTrend={dashData.monthlyTrend}
        branchCompliance={dashData.branchCompliance}
      />

      <div className="grid-4" style={{ marginTop: 24 }}>
        {[
          { href: '/staff-directory', icon: '👥', title: 'Staff Directory' },
          { href: '/hospital/departments', icon: '🏬', title: 'Departments' },
          { href: '/hospital/units', icon: '🔲', title: 'Units' },
          { href: '/assessments', icon: '✅', title: 'Assessments' },
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
