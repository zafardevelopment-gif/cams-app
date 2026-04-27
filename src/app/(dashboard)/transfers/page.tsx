import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { TransfersClient } from './TransfersClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Staff Transfers — CAMS' }

export default async function TransfersPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser!.id)
    .single()

  const { data: transfers } = await admin
    .from(T.transfers)
    .select(`id, status, head_nurse_approval, admin_approval, reason, effective_date, notes, created_at,
      staff:${J.users}!staff_id(id, full_name, job_title),
      from_hospital:${J.hospitals}!from_hospital_id(name),
      to_hospital:${J.hospitals}!to_hospital_id(name),
      from_dept:${J.departments}!from_department_id(name),
      to_dept:${J.departments}!to_department_id(name)`)
    .order('created_at', { ascending: false })
    .limit(100)

  const canApprove = ['super_admin', 'hospital_admin', 'branch_admin', 'head_nurse', 'department_head', 'unit_head'].includes(profile?.role ?? '')

  return (
    <TransfersClient
      transfers={transfers ?? []}
      callerRole={profile?.role ?? 'staff'}
      canApprove={canApprove}
    />
  )
}
