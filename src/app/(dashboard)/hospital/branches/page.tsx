import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { BranchesClient } from './BranchesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Branches — CAMS' }

export default async function BranchesPage() {
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

  const { data: branches } = await admin
    .from(T.branches)
    .select('*')
    .eq('hospital_id', profile.hospital_id ?? '')
    .order('name')

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Branches</h1>
          <p>Manage hospital branches and locations</p>
        </div>
        <div className="page-header-actions">
          <Link href="/hospital-admin" className="btn btn-secondary btn-sm">← Dashboard</Link>
        </div>
      </div>

      <BranchesClient branches={branches ?? []} />
    </>
  )
}
