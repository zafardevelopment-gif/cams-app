import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Certificates — CAMS' }

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', expiring_soon: 'badge-yellow', expired: 'badge-red', revoked: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired', revoked: 'Revoked',
}

export default async function CertificatesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  let query = admin
    .from(T.certificates)
    .select(`id, certificate_number, status, overall_score, issued_date, expiry_date, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title, category)`)
    .order('issued_date', { ascending: false })
    .limit(50)

  if (profile?.role === 'staff') {
    query = query.eq('staff_id', authUser!.id) as typeof query
  } else if (profile?.hospital_id) {
    query = query.eq('hospital_id', profile.hospital_id) as typeof query
  }

  const { data: certificates } = await query
  const list = certificates ?? []

  const activeCerts = list.filter((c) => c.status === 'active').length
  const expiringCerts = list.filter((c) => c.status === 'expiring_soon').length
  const expiredCerts = list.filter((c) => c.status === 'expired').length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Certificates</h1>
          <p>{list.length} total certificates</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm">📥 Export All</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>✅</div>
          <div className="kpi-label">Active</div>
          <div className="kpi-value">{activeCerts}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFF8E1' }}>⚠️</div>
          <div className="kpi-label">Expiring Soon</div>
          <div className="kpi-value">{expiringCerts}</div>
          {expiringCerts > 0 && <div className="kpi-change down">Renewal needed</div>}
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFEBEE' }}>❌</div>
          <div className="kpi-label">Expired</div>
          <div className="kpi-value">{expiredCerts}</div>
          {expiredCerts > 0 && <div className="kpi-change down">Overdue</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Certificate #</th>
                  <th>Competency</th>
                  <th>Score</th>
                  <th>Issued</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const staffRaw = c.staff as unknown
                  const templateRaw = c.template as unknown
                  const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw as { full_name: string; job_title: string } | null
                  const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string; category: string } | null
                  return (
                    <tr key={c.id}>
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
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>
                          {c.certificate_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{template?.title ?? '—'}</div>
                        <div className="text-xs text-muted">{template?.category ?? '—'}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.overall_score != null ? `${c.overall_score}%` : '—'}</td>
                      <td className="text-sm">{c.issued_date}</td>
                      <td>
                        <span className="text-sm">{c.expiry_date}</span>
                        {c.status === 'expiring_soon' && (
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--amber)' }}>Expiring soon</span>
                        )}
                        {c.status === 'expired' && (
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--red)' }}>Expired</span>
                        )}
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-gray'}`}>{STATUS_LABEL[c.status] ?? c.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Link href={`/certificates/${c.id}`} className="btn btn-secondary btn-sm">View</Link>
                          <button className="btn btn-teal btn-sm">📄 PDF</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No certificates found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
