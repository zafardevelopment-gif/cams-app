import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import { getSuperAdminPlatformReport } from '@/actions/reports'
import SuperAdminReportsClient from './SuperAdminReportsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Platform Report — CAMS' }

export default async function SuperAdminReportsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') redirect('/login')

  const result = await getSuperAdminPlatformReport()

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Platform Report</h1>
          <p>Super Admin · All hospitals · Financial & operational overview</p>
        </div>
        <div className="page-header-actions">
          <Link href="/super-admin" className="btn btn-secondary btn-sm">← Overview</Link>
        </div>
      </div>

      <SuperAdminReportsClient data={result.data} />
    </>
  )
}
