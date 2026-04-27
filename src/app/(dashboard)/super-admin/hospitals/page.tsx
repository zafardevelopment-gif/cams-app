import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Manage Hospitals — CAMS' }

export default async function ManageHospitalsPage() {
  const admin = createAdminClient()
  const { data: hospitals } = await admin
    .from(T.hospitals)
    .select('id, name, contact_email, region, city, subscription_plan, cbahi_accredited, is_active, created_at')
    .order('created_at')

  const list = hospitals ?? []
  const active = list.filter((h) => h.is_active).length
  const inactive = list.filter((h) => !h.is_active).length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Manage Hospitals</h1>
          <p>{list.length} total hospital accounts</p>
        </div>
        <div className="page-header-actions">
          <Link href="/super-admin" className="btn btn-secondary btn-sm">← Overview</Link>
          <button className="btn btn-primary btn-sm">＋ Add Hospital</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>✅</div>
          <div className="kpi-label">Active</div>
          <div className="kpi-value">{active}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFEBEE' }}>⏸️</div>
          <div className="kpi-label">Inactive</div>
          <div className="kpi-value">{inactive}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>🏥</div>
          <div className="kpi-label">Total</div>
          <div className="kpi-value">{list.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Region / City</th>
                  <th>Plan</th>
                  <th>CBAHI</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div className="staff-name-cell">
                        <div className="staff-avatar" style={{ background: 'linear-gradient(135deg,var(--blue),var(--teal))' }}>🏥</div>
                        <div>
                          <h4>{h.name}</h4>
                          <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{h.contact_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{h.region} · {h.city}</td>
                    <td><span className="badge badge-blue">{h.subscription_plan}</span></td>
                    <td>{h.cbahi_accredited ? '✅' : '—'}</td>
                    <td>
                      <span className={`badge ${h.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {h.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-sm text-muted">{new Date(h.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm">View</button>
                        <button className="btn btn-secondary btn-sm">Edit</button>
                        {h.is_active
                          ? <button className="btn btn-danger btn-sm">Suspend</button>
                          : <button className="btn btn-success btn-sm">Activate</button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No hospitals found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
