import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'

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

  const hospitalId = profile?.hospital_id ?? ''

  const [{ data: staff }, { data: certs }, { data: pendingApprovals }] = await Promise.all([
    admin.from(T.users).select('id').eq('hospital_id', hospitalId).eq('status', 'active'),
    admin.from(T.certificates).select('id, status').eq('hospital_id', hospitalId),
    admin.from(T.approvals)
      .select(`id, assessment:${J.assessments}!assessment_id(hospital_id)`)
      .eq('status', 'pending'),
  ])

  const activeCerts = (certs ?? []).filter((c) => c.status === 'active').length
  const expiringCerts = (certs ?? []).filter((c) => c.status === 'expiring_soon').length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>HR / Quality Dashboard</h1>
          <p>Compliance and quality overview</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '👥', label: 'Active Staff', value: (staff ?? []).length, bg: '#E3F2FD' },
          { icon: '🏅', label: 'Active Certificates', value: activeCerts, bg: '#E8F5E9' },
          { icon: '⚠️', label: 'Expiring Certs', value: expiringCerts, bg: '#FFEBEE', alert: expiringCerts > 0 },
          { icon: '✍️', label: 'Pending Approvals', value: (pendingApprovals ?? []).length, bg: '#FFF3E0' },
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
