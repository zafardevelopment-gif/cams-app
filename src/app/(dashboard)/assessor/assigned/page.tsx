import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { getInitials } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Assigned Assessments — CAMS' }

const STATUS_BADGE: Record<string, string> = {
  assessor_review: 'badge-blue', submitted: 'badge-purple', in_progress: 'badge-yellow',
  not_started: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  assessor_review: 'Assessor Review', submitted: 'Submitted',
  in_progress: 'In Progress', not_started: 'Not Started',
}

export default async function AssessorAssignedPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: assessments } = await admin
    .from(T.assessments)
    .select(`id, status, due_date, created_at, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title, category)`)
    .eq('assessor_id', authUser!.id)
    .not('status', 'in', '("passed","failed","head_nurse_review","admin_review")')
    .order('created_at', { ascending: false })

  const list = assessments ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Assigned Assessments</h1>
          <p>{list.length} pending evaluation{list.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="card">
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
                  const staff = Array.isArray(a.staff) ? a.staff[0] : a.staff as { full_name: string; job_title: string } | null
                  const template = Array.isArray(a.template) ? a.template[0] : a.template as { title: string; category: string } | null
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg,var(--blue),var(--teal))' }}>
                            {getInitials(staff?.full_name ?? '?')}
                          </div>
                          <div>
                            <h4>{staff?.full_name ?? '—'}</h4>
                            <p className="text-xs text-muted">{staff?.job_title ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{template?.title ?? '—'}</td>
                      <td><span className="badge badge-teal">{template?.category ?? '—'}</span></td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                      <td className="text-sm text-muted">{a.due_date ?? '—'}</td>
                      <td>
                        <Link href={`/assessments/${a.id}`} className="btn btn-primary btn-sm">Evaluate</Link>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No pending assessments</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
