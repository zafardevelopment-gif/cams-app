import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Assessor Dashboard — CAMS' }

const STATUS_BADGE: Record<string, string> = {
  assessor_review: 'badge-blue', submitted: 'badge-purple', in_progress: 'badge-yellow',
  passed: 'badge-green', failed: 'badge-red', not_started: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  assessor_review: 'Assessor Review', submitted: 'Submitted', in_progress: 'In Progress',
  passed: 'Passed', failed: 'Failed', not_started: 'Not Started',
}

export default async function AssessorPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: assessments } = await admin
    .from(T.assessments)
    .select(`id, status, due_date, created_at, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title, category)`)
    .eq('assessor_id', authUser!.id)
    .not('status', 'in', '("passed","failed")')
    .order('created_at', { ascending: false })

  const list = assessments ?? []
  const completedToday = 0

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Assessor Dashboard</h1>
          <p>Manage assigned assessments and evaluations</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '📋', label: 'Assigned Assessments', value: list.length, bg: '#E3F2FD', alert: list.length > 0 },
          { icon: '✅', label: 'Completed Today', value: completedToday, bg: '#E8F5E9' },
          { icon: '🔍', label: 'Pending Review', value: list.filter((a) => a.status === 'assessor_review').length, bg: '#FFF8E1' },
          { icon: '⏰', label: 'In Progress', value: list.filter((a) => a.status === 'in_progress').length, bg: '#E0F2F1' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && list.length > 0 && <div className="kpi-change down">Review needed</div>}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Assigned Assessments</div>
            <div className="card-subtitle">Click to review each assessment</div>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Competency</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const staffRaw = a.staff as unknown
                  const templateRaw = a.template as unknown
                  const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw as { full_name: string; job_title: string } | null
                  const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string; category: string } | null
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg, var(--blue), var(--teal))' }}>
                            {getInitials(staff?.full_name ?? '?')}
                          </div>
                          <div>
                            <h4>{staff?.full_name ?? '—'}</h4>
                            <p>{staff?.job_title ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{template?.title ?? '—'}</td>
                      <td><span className="badge badge-teal">{template?.category ?? '—'}</span></td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                      <td className="text-sm">{a.due_date ?? '—'}</td>
                      <td>
                        <Link href={`/assessments/${a.id}`} className="btn btn-primary btn-sm">Evaluate</Link>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No assigned assessments</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
