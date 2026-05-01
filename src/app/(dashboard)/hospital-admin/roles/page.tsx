import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import { getRoleDefinitions } from '@/actions/roles'
import { RolesClient } from './RolesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Role & Permission Builder — CAMS' }

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser!.id)
    .single()

  if (!profile || profile.role !== 'hospital_admin') {
    return <div className="alert alert-danger">Unauthorized — Hospital Admin only</div>
  }

  if (!profile.hospital_id) redirect('/hospital-admin')

  const roles = await getRoleDefinitions(profile.hospital_id)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Role &amp; Permission Builder</h1>
          <p>Define what each role can see and do across modules</p>
        </div>
        <div className="page-header-actions">
          <Link href="/hospital-admin" className="btn btn-secondary btn-sm">← Dashboard</Link>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 8,
        padding: '12px 16px', marginBottom: 20, fontSize: '0.82rem', color: '#795548',
        display: 'flex', gap: 20, flexWrap: 'wrap',
      }}>
        <span>🔑 <strong>System roles</strong> — built-in roles with default permissions. You can customise their permissions but not delete them.</span>
        <span>🎭 <strong>Custom roles</strong> — fully customisable roles unique to your hospital.</span>
        <span>📍 <strong>Scope</strong> — controls which data boundary the role can access (hospital → branch → department → unit).</span>
      </div>

      <RolesClient roles={roles} hospitalId={profile.hospital_id} />
    </>
  )
}
