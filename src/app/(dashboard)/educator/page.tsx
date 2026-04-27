import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'

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

  const [{ data: assigned }, { data: templates }] = await Promise.all([
    admin.from(T.assessments).select('id, status').eq('assessor_id', authUser!.id).neq('status', 'passed').neq('status', 'failed'),
    admin.from(T.competency_templates).select('id').eq('hospital_id', profile?.hospital_id ?? '').eq('is_active', true),
  ])

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Educator Dashboard</h1>
          <p>Your assessment and training overview</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {[
          { icon: '📋', label: 'Assigned Assessments', value: (assigned ?? []).length, bg: '#E3F2FD' },
          { icon: '📚', label: 'Active Templates', value: (templates ?? []).length, bg: '#E8F5E9' },
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
          { href: '/assessor/assigned', icon: '📋', title: 'Assigned Assessments' },
          { href: '/assessor/completed', icon: '✅', title: 'Completed' },
          { href: '/competencies', icon: '📚', title: 'Templates' },
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
