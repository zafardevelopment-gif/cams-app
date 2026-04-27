import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'
import { DepartmentsClient } from './DepartmentsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Departments — CAMS' }

export default async function DepartmentsPage() {
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

  const [{ data: departments }, { data: branches }] = await Promise.all([
    admin
      .from(T.departments)
      .select(`*, branch:${J.branches}!branch_id(id, name)`)
      .eq('hospital_id', hospitalId)
      .order('name'),
    admin
      .from(T.branches)
      .select('id, name')
      .eq('hospital_id', hospitalId)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Departments</h1>
          <p>Assign departments to branches</p>
        </div>
        <div className="page-header-actions">
          <Link href="/hospital/branches" className="btn btn-secondary btn-sm">Manage Branches</Link>
          <Link href="/hospital-admin" className="btn btn-secondary btn-sm">← Dashboard</Link>
        </div>
      </div>

      <DepartmentsClient departments={departments ?? []} branches={branches ?? []} />
    </>
  )
}
