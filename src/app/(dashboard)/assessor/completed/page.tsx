import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { getInitials } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Completed Evaluations — CAMS' }

const STATUS_BADGE: Record<string, string> = {
  passed: 'badge-green', failed: 'badge-red',
  head_nurse_review: 'badge-teal', admin_review: 'badge-purple',
}
const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed', failed: 'Failed',
  head_nurse_review: 'HN Review', admin_review: 'Admin Review',
}

export default async function AssessorCompletedPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: assessments } = await admin
    .from(T.assessments)
    .select(`id, status, due_date, created_at, overall_score, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title, category)`)
    .eq('assessor_id', authUser!.id)
    .in('status', ['passed', 'failed', 'head_nurse_review', 'admin_review'])
    .order('created_at', { ascending: false })

  const list = assessments ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Completed Evaluations</h1>
          <p>{list.length} evaluation{list.length !== 1 ? 's' : ''} submitted</p>
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
                  <th>Overall Score</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
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
                      <td>
                        {a.overall_score != null
                          ? <span style={{ fontWeight: 700, color: a.overall_score >= 80 ? 'var(--green,#16a34a)' : 'var(--red)' }}>{a.overall_score}%</span>
                          : <span className="text-muted">—</span>
                        }
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                      <td className="text-sm text-muted">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td>
                        <Link href={`/assessments/${a.id}`} className="btn btn-secondary btn-sm">View</Link>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No completed evaluations yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
