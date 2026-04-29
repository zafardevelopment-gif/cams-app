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

  const hospitalId = profile?.hospital_id ?? ''
  const role = profile?.role ?? 'staff'

  // Load filter options (branches, departments)
  const [{ data: branches }, { data: departments }, { data: hospital }] = await Promise.all([
    admin.from(T.branches).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true).order('name'),
    admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true).order('name'),
    admin.from(T.hospitals).select('id, name').eq('id', hospitalId).single(),
  ])

  return (
    <ReportsClient
      hospitalId={hospitalId}
      role={role}
      hospitalName={hospital?.name ?? ''}
      branches={branches ?? []}
      departments={departments ?? []}
    />
  )
}
