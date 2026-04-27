import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Head Nurse Dashboard — CAMS' }

export default async function HeadNursePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('hospital_id, department_id').eq('id', authUser!.id).single()

  const [{ data: pendingApprovals }, { data: myStaff }] = await Promise.all([
    admin.from(T.approvals)
      .select(`id, level, assessment_id, assessment:${J.assessments}!assessment_id(id, status, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title))`)
      .eq('status', 'pending')
      .eq('approver_role', 'head_nurse')
      .limit(10),
    admin.from(T.users)
      .select('id, full_name, job_title, status')
      .eq('department_id', profile?.department_id ?? '')
      .neq('id', authUser!.id)
      .order('full_name'),
  ])

  const approvals = (pendingApprovals ?? [])
  const staff = (myStaff ?? [])
  const expiringCount = 0 // could query certificates

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Unit Dashboard</h1>
          <p>Manage your nursing unit&apos;s competencies</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary btn-sm">📊 Reports</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '👥', label: 'Unit Staff', value: staff.length, bg: '#E3F2FD' },
          { icon: '✍️', label: 'My Pending Approvals', value: approvals.length, bg: '#FFF8E1', alert: approvals.length > 0 },
          { icon: '⚠️', label: 'Expiring Certs', value: expiringCount, bg: '#FFEBEE', alert: false },
          { icon: '✅', label: 'Action Required', value: approvals.length, bg: '#E8F5E9' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Pending Approvals</div>
              <div className="card-subtitle">Assessments awaiting your review</div>
            </div>
            <Link href="/head-nurse/approvals" className="btn btn-primary btn-sm">View All</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Staff</th><th>Competency</th><th>Level</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {approvals.map((ap) => {
                    const assessmentRaw = ap.assessment as unknown
                    const assessment = Array.isArray(assessmentRaw) ? assessmentRaw[0] : assessmentRaw as { id: string; staff?: { full_name: string } | { full_name: string }[]; template?: { title: string } | { title: string }[] } | null
                    const staffRaw = assessment?.staff
                    const staffObj = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw as { full_name: string } | null
                    const templateRaw = assessment?.template
                    const templateObj = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string } | null
                    return (
                      <tr key={ap.id}>
                        <td style={{ fontWeight: 600 }}>{staffObj?.full_name ?? '—'}</td>
                        <td className="text-sm text-muted">{templateObj?.title ?? '—'}</td>
                        <td><span className="badge badge-blue">Level {ap.level}</span></td>
                        <td>
                          <Link href={`/assessments/${ap.assessment_id}`} className="btn btn-primary btn-sm">Review</Link>
                        </td>
                      </tr>
                    )
                  })}
                  {approvals.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No pending approvals</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Unit Staff</div>
              <div className="card-subtitle">{staff.length} members</div>
            </div>
            <Link href="/staff-directory" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Staff</th><th>Role</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg, var(--blue), var(--teal))' }}>
                            {getInitials(s.full_name)}
                          </div>
                          <span style={{ fontWeight: 600 }}>{s.full_name}</span>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{s.job_title}</td>
                      <td><span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>{s.status}</span></td>
                    </tr>
                  ))}
                  {staff.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No staff in this unit</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
