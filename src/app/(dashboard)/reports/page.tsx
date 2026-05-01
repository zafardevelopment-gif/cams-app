import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import ReportsClient from './ReportsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports & Analytics — CAMS' }

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('role, hospital_id, branch_id, department_id')
    .eq('id', authUser!.id)
    .single()

  const role = profile?.role ?? 'staff'
  const isSuperAdmin = role === 'super_admin'

  // Super admin starts with no hospital selected; others use their own hospital
  const hospitalId = isSuperAdmin ? '' : (profile?.hospital_id ?? '')

  const [{ data: branches }, { data: departments }, { data: hospital }, { data: allHospitals }] = await Promise.all([
    hospitalId
      ? admin.from(T.branches).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true).order('name')
      : Promise.resolve({ data: [] }),
    hospitalId
      ? admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true).order('name')
      : Promise.resolve({ data: [] }),
    hospitalId
      ? admin.from(T.hospitals).select('id, name').eq('id', hospitalId).single()
      : Promise.resolve({ data: null }),
    isSuperAdmin
      ? admin.from(T.hospitals).select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <ReportsClient
      hospitalId={hospitalId}
      role={role}
      hospitalName={hospital?.name ?? ''}
      branches={branches ?? []}
      departments={departments ?? []}
      allHospitals={isSuperAdmin ? (allHospitals ?? []) : []}
    />
  )
}
