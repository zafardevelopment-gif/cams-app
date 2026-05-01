import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'
import { UnitsClient } from './UnitsClient'
import { getHospitalConfig } from '@/actions/hospitalConfig'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Units — CAMS' }

export default async function UnitsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('hospital_id, role')
    .eq('id', authUser!.id)
    .single()

  if (!profile || !['hospital_admin', 'super_admin'].includes(profile.role)) {
    return <div className="alert alert-danger">Unauthorized</div>
  }

  const hospitalId = profile.hospital_id ?? ''

  const [{ data: units }, { data: departments }, { data: branches }, hospitalConfig] = await Promise.all([
    admin
      .from(T.units)
      .select(`*, department:${J.departments}!department_id(id, name), branch:${J.branches}!branch_id(id, name)`)
      .eq('hospital_id', hospitalId)
      .order('name'),
    admin
      .from(T.departments)
      .select('id, name')
      .eq('hospital_id', hospitalId)
      .eq('is_active', true)
      .order('name'),
    admin
      .from(T.branches)
      .select('id, name')
      .eq('hospital_id', hospitalId)
      .eq('is_active', true)
      .order('name'),
    profile.role === 'hospital_admin' ? getHospitalConfig(hospitalId) : Promise.resolve(null),
  ])

  // Redirect away if units are disabled in config
  if (profile.role === 'hospital_admin' && hospitalConfig?.hasUnits === false) {
    redirect('/hospital-admin')
  }

  if (profile.role === 'hospital_admin' && hospitalConfig?.hasBranches && (branches ?? []).length === 0) {
    redirect('/hospital/branches')
  }

  const hasBranches = hospitalConfig?.hasBranches ?? true

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Units</h1>
          <p>Manage units within departments</p>
        </div>
        <div className="page-header-actions">
          <Link href="/hospital/departments" className="btn btn-secondary btn-sm">Departments</Link>
          <Link href="/hospital-admin" className="btn btn-secondary btn-sm">← Dashboard</Link>
        </div>
      </div>

      <UnitsClient units={units ?? []} departments={departments ?? []} branches={branches ?? []} hasBranches={hasBranches} />
    </>
  )
}
