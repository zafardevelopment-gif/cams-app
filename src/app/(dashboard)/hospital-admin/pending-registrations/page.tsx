import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import { ApprovalActions } from './ApprovalActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pending Registrations — CAMS' }

export default async function PendingRegistrationsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  let query = admin
    .from(T.registration_requests)
    .select('id, full_name, email, phone, job_title, role, department_id, nursing_license, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (profile?.role !== 'super_admin' && profile?.hospital_id) {
    query = query.eq('hospital_id', profile.hospital_id) as typeof query
  }

  const { data: requests } = await query
  const list = requests ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Pending Registrations</h1>
          <p>{list.length} requests awaiting review</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Job Title</th>
                  <th>License</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{r.email}</div>
                        {r.phone && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.phone}</div>}
                      </div>
                    </td>
                    <td className="text-sm">{r.job_title}</td>
                    <td className="text-sm text-muted">{r.nursing_license}</td>
                    <td className="text-sm text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      <ApprovalActions registrationId={r.id} name={r.full_name} defaultRole={r.role ?? 'staff'} />
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No pending registrations</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
