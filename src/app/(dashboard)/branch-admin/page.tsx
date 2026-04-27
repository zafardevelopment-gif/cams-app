import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'

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

  const [{ data: staff }, { data: pendingRegs }, { data: assessments }] = await Promise.all([
    admin.from(T.users).select('id').eq('hospital_id', profile?.hospital_id ?? '').eq('branch_id', profile?.branch_id ?? '').eq('status', 'active'),
    admin.from(T.registration_requests).select('id').eq('hospital_id', profile?.hospital_id ?? '').eq('status', 'pending'),
    admin.from(T.assessments).select('id, status').eq('hospital_id', profile?.hospital_id ?? '').eq('branch_id', profile?.branch_id ?? ''),
  ])

  const activeAssessments = (assessments ?? []).filter((a) => !['passed', 'failed'].includes(a.status)).length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Branch Dashboard</h1>
          <p>Overview for your branch</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { icon: '👥', label: 'Branch Staff', value: (staff ?? []).length, bg: '#E3F2FD' },
          { icon: '📋', label: 'Pending Registrations', value: (pendingRegs ?? []).length, bg: '#F3E5F5' },
          { icon: '✅', label: 'Active Assessments', value: activeAssessments, bg: '#E8F5E9' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-4" style={{ marginTop: 24 }}>
        {[
          { href: '/staff-directory', icon: '👥', title: 'Staff Directory' },
          { href: '/hospital/departments', icon: '🏬', title: 'Departments' },
          { href: '/hospital/units', icon: '🔲', title: 'Units' },
          { href: '/assessments', icon: '✅', title: 'Assessments' },
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
