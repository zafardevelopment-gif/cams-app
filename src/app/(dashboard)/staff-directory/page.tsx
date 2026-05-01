import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { StaffDirectoryClient } from './StaffDirectoryClient'
import { getHospitalConfig } from '@/actions/hospitalConfig'
import { getRoleDefinitions } from '@/actions/roles'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Staff Directory — CAMS' }

export default async function StaffDirectoryPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser!.id)
    .single()

  const hospitalId = profile?.hospital_id ?? ''
  const isSuperAdmin = profile?.role === 'super_admin'

  const [staffRes, deptRes, branchRes, hospitalConfig, roleDefs] = await Promise.all([
    isSuperAdmin
      ? admin.from(T.users)
          .select(`id, full_name, email, job_title, role, employee_id, nursing_license, license_expiry, hired_date, status, created_at, hospital_id, department_id, branch_id, unit_id, archived_at, department:${J.departments}!department_id(name), branch:${J.branches}!branch_id(name)`)
          .order('full_name')
          .limit(500)
      : admin.from(T.users)
          .select(`id, full_name, email, job_title, role, employee_id, nursing_license, license_expiry, hired_date, status, created_at, hospital_id, department_id, branch_id, unit_id, archived_at, department:${J.departments}!department_id(name), branch:${J.branches}!branch_id(name)`)
          .eq('hospital_id', hospitalId)
          .order('full_name')
          .limit(500),
    admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true).order('name'),
    admin.from(T.branches).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true).order('name'),
    !isSuperAdmin && profile?.role === 'hospital_admin' ? getHospitalConfig(hospitalId) : Promise.resolve(null),
    !isSuperAdmin ? getRoleDefinitions(hospitalId) : Promise.resolve([]),
  ])

  // License expiry alert: expiring within 60 days
  const today = new Date()
  const in60 = new Date(today); in60.setDate(in60.getDate() + 60)
  const expiringLicenses = (staffRes.data ?? []).filter((s) => {
    if (!s.license_expiry) return false
    const exp = new Date(s.license_expiry)
    return exp >= today && exp <= in60
  })
  const expiredLicenses = (staffRes.data ?? []).filter((s) => {
    if (!s.license_expiry) return false
    return new Date(s.license_expiry) < today
  })

  const canManage = ['super_admin', 'hospital_admin', 'branch_admin', 'hr_quality'].includes(profile?.role ?? '')

  if (!isSuperAdmin && profile?.role === 'hospital_admin' && hospitalConfig?.hasBranches && (branchRes.data ?? []).length === 0) {
    redirect('/hospital/branches')
  }

  const roleOptions = (roleDefs ?? [])
    .filter((r) => r.is_active !== false)
    .map((r) => ({ role_key: r.role_key, display_name: r.display_name, is_system: r.is_system }))

  return (
    <StaffDirectoryClient
      staff={staffRes.data ?? []}
      departments={deptRes.data ?? []}
      branches={branchRes.data ?? []}
      callerRole={profile?.role ?? 'staff'}
      callerHospitalId={hospitalId}
      canManage={canManage}
      expiringCount={expiringLicenses.length}
      expiredCount={expiredLicenses.length}
      roleOptions={roleOptions}
    />
  )
}
