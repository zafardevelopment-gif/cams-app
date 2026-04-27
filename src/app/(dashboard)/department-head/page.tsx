import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Department Head Dashboard — CAMS' }

export default async function DepartmentHeadPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('hospital_id, department_id, full_name')
    .eq('id', authUser!.id)
    .single()

  const [{ data: staff }, { data: pendingApprovals }, { data: assessments }] = await Promise.all([
    admin.from(T.users).select('id').eq('department_id', profile?.department_id ?? '').eq('status', 'active'),
    admin.from(T.approvals)
      .select(`id, assessment:${J.assessments}!assessment_id(hospital_id)`)
      .eq('status', 'pending'),
    admin.from(T.assessments).select('id, status').eq('department_id', profile?.department_id ?? ''),
  ])

  const activeAssessments = (assessments ?? []).filter((a) => !['passed', 'failed'].includes(a.status)).length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Department Dashboard</h1>
          <p>Overview for your department</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { icon: '👥', label: 'Department Staff', value: (staff ?? []).length, bg: '#E3F2FD' },
          { icon: '✍️', label: 'Pending Approvals', value: (pendingApprovals ?? []).length, bg: '#FFF3E0', alert: (pendingApprovals ?? []).length > 0 },
          { icon: '✅', label: 'Active Assessments', value: activeAssessments, bg: '#E8F5E9' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <div className="grid-4" style={{ marginTop: 24 }}>
        {[
          { href: '/staff-directory', icon: '👥', title: 'My Staff' },
          { href: '/head-nurse/approvals', icon: '✍️', title: 'Pending Approvals' },
          { href: '/assessments', icon: '✅', title: 'Assessments' },
          { href: '/hospital/units', icon: '🔲', title: 'Units' },
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
