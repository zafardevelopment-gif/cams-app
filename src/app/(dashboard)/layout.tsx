import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { T, J } from '@/lib/db'
import type { User } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select(`*, hospital:${J.hospitals}(*), department:${J.departments}(*)`)
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login?message=account_pending')
  if (profile.status === 'suspended') redirect('/login?error=account_suspended')
  if (profile.status === 'pending') redirect('/login?message=account_pending')

  return (
    <DashboardShell user={profile as User}>
      {children}
    </DashboardShell>
  )
}
