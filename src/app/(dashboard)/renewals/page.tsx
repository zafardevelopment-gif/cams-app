import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Renewals — CAMS' }

const STATUS_BADGE: Record<string, string> = {
  overdue: 'badge-red', due: 'badge-yellow', upcoming: 'badge-blue', completed: 'badge-green', in_progress: 'badge-purple',
}
const STATUS_LABEL: Record<string, string> = {
  overdue: 'Overdue', due: 'Due', upcoming: 'Upcoming', completed: 'Completed', in_progress: 'In Progress',
}

export default async function RenewalsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  let query = admin
    .from(T.renewals)
    .select(`id, status, due_date, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title, category), certificate:${J.certificates}!certificate_id(certificate_number)`)
    .not('status', 'eq', 'completed')
    .order('due_date')
    .limit(50)

  if (profile?.role === 'staff') {
    query = query.eq('staff_id', authUser!.id) as typeof query
  }

  const { data: renewals } = await query
  const list = renewals ?? []
  const today = new Date()

  const overdue = list.filter((r) => new Date(r.due_date) < today && r.status !== 'completed').length
  const due30 = list.filter((r) => {
    const d = new Date(r.due_date)
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30
  }).length
  const upcoming = list.filter((r) => {
    const d = new Date(r.due_date)
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 30 && diff <= 90
  }).length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Certificate Renewals</h1>
          <p>Track upcoming and overdue certificate renewals</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm">📥 Export</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFEBEE' }}>🔴</div>
          <div className="kpi-label">Overdue</div>
          <div className="kpi-value">{overdue}</div>
          {overdue > 0 && <div className="kpi-change down">Immediate action needed</div>}
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFF8E1' }}>⚠️</div>
          <div className="kpi-label">Due within 30 days</div>
          <div className="kpi-value">{due30}</div>
          {due30 > 0 && <div className="kpi-change down">Action required soon</div>}
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>📅</div>
          <div className="kpi-label">Due in 30–90 days</div>
          <div className="kpi-value">{upcoming}</div>
          <div className="kpi-change neutral">Plan ahead</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">All Renewals</div>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Competency</th>
                  <th>Certificate #</th>
                  <th>Due Date</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const staffRaw = r.staff as unknown
                  const templateRaw = r.template as unknown
                  const certRaw = r.certificate as unknown
                  const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw as { full_name: string; job_title: string } | null
                  const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string } | null
                  const cert = Array.isArray(certRaw) ? certRaw[0] : certRaw as { certificate_number: string } | null
                  const dueDate = new Date(r.due_date)
                  const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg,var(--blue),var(--teal))' }}>
                            {getInitials(staff?.full_name ?? '?')}
                          </div>
                          <div>
                            <h4>{staff?.full_name ?? '—'}</h4>
                            <p>{staff?.job_title ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{template?.title ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>{cert?.certificate_number ?? '—'}</td>
                      <td className="text-sm">{r.due_date}</td>
                      <td>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: daysLeft < 0 ? 'var(--red)' : daysLeft <= 7 ? 'var(--red)' : daysLeft <= 30 ? 'var(--amber)' : 'var(--green)',
                        }}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                        </span>
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-gray'}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                      <td>
                        <Link href="/competencies" className="btn btn-primary btn-sm">Start Renewal</Link>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No renewals pending</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
