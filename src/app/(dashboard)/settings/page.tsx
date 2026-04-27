import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { ProfileForm, PasswordForm } from '@/components/settings/SettingsForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings — CAMS' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select(`full_name, email, phone, job_title, nursing_license, hospital:${J.hospitals}!hospital_id(name, city, contact_email)`)
    .eq('id', authUser!.id)
    .single()

  const hospitalRaw = profile?.hospital as unknown
  const hospital = Array.isArray(hospitalRaw) ? hospitalRaw[0] : hospitalRaw as { name: string; city: string; contact_email: string } | null

  const profileFields = [
    { label: 'Full Name', value: profile?.full_name ?? '', name: 'full_name', type: 'text' },
    { label: 'Email Address', value: profile?.email ?? authUser?.email ?? '', name: 'email', type: 'email', readonly: true },
    { label: 'Phone Number', value: profile?.phone ?? '', name: 'phone', type: 'tel' },
    { label: 'Job Title', value: profile?.job_title ?? '', name: 'job_title', type: 'text' },
    { label: 'Nursing License', value: profile?.nursing_license ?? '', name: 'nursing_license', type: 'text' },
  ]

  const hospitalFields = hospital ? [
    { label: 'Hospital Name', value: hospital.name, name: 'hospital_name', type: 'text', readonly: true },
    { label: 'City', value: hospital.city, name: 'city', type: 'text', readonly: true },
    { label: 'Contact Email', value: hospital.contact_email, name: 'contact_email', type: 'email', readonly: true },
  ] : []

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Settings</h1>
          <p>Manage your profile and preferences</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div className="card" style={{ width: 200, flexShrink: 0, padding: 8 }}>
          {[
            { icon: '👤', label: 'Profile' },
            { icon: '🔒', label: 'Security' },
            { icon: '🔔', label: 'Notifications' },
            { icon: '🏥', label: 'Hospital' },
            { icon: '⚙️', label: 'Approval Workflow' },
          ].map((item, i) => (
            <div key={item.label} className={`nav-item ${i === 0 ? 'active' : ''}`} style={{ color: i === 0 ? 'var(--navy)' : 'var(--gray-700)' }}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>👤</span>
                <div className="card-title">Profile Settings</div>
              </div>
            </div>
            <div className="card-body">
              <ProfileForm profileFields={profileFields} />
            </div>
          </div>

          {hospitalFields.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🏥</span>
                  <div className="card-title">Hospital Information</div>
                </div>
              </div>
              <div className="card-body">
                <div className="grid-2">
                  {hospitalFields.map((field) => (
                    <div key={field.name} className="form-group">
                      <label className="form-label">{field.label}</label>
                      <input type={field.type} defaultValue={field.value} className="form-control" readOnly style={{ background: 'var(--gray-50)', color: 'var(--gray-500)' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔒</span>
                <div className="card-title">Change Password</div>
              </div>
            </div>
            <div className="card-body">
              <PasswordForm />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔔</span>
                <div className="card-title">Notification Preferences</div>
              </div>
            </div>
            <div className="card-body">
              {[
                { label: 'Assessment assigned to me', key: 'assessment_assigned' },
                { label: 'Approval required', key: 'approval_required' },
                { label: 'Certificate issued', key: 'certificate_issued' },
                { label: 'Renewal due (90 days)', key: 'renewal_90' },
                { label: 'Renewal due (30 days)', key: 'renewal_30' },
                { label: 'Certificate expired', key: 'cert_expired' },
              ].map((pref) => (
                <div key={pref.key} className="stat-row">
                  <span className="stat-label">{pref.label}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked /> In-app
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked /> Email
                    </label>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-primary btn-sm">Save Preferences</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
