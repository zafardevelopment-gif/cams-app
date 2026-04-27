import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'

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

  const [{ data: staff }, { data: pendingApprovals }] = await Promise.all([
    admin.from(T.users).select('id').eq('unit_id', profile?.unit_id ?? '').eq('status', 'active'),
    admin.from(T.approvals)
      .select(`id, assessment:${J.assessments}!assessment_id(hospital_id)`)
      .eq('status', 'pending'),
  ])

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Unit Dashboard</h1>
          <p>Overview for your unit</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {[
          { icon: '👥', label: 'Unit Staff', value: (staff ?? []).length, bg: '#E3F2FD' },
          { icon: '✍️', label: 'Pending Approvals', value: (pendingApprovals ?? []).length, bg: '#FFF3E0', alert: (pendingApprovals ?? []).length > 0 },
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
          { href: '/certificates', icon: '🏅', title: 'Certificates' },
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
