import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardShell } from '@/components/layout/DashboardShell'
import SubscriptionBanner from '@/components/billing/SubscriptionBanner'
import { T, J } from '@/lib/db'
import type { User } from '@/types'
import { getUnreadCount } from '@/actions/notifications'

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

  // Fetch subscription for banner (only for hospital-scoped roles)
  let subStatus: string | null = null
  let subPlanId = ''
  let subPeriodEnd: string | null = null

  if (profile.hospital_id && profile.role !== 'super_admin') {
    const { data: sub } = await admin
      .from(T.subscriptions)
      .select('status, plan_id, current_period_end')
      .eq('hospital_id', profile.hospital_id)
      .single()

    if (sub) {
      subStatus = sub.status
      subPlanId = sub.plan_id
      subPeriodEnd = sub.current_period_end ?? null
    }
  }

  const unreadCount = await getUnreadCount()

  return (
    <>
      {subStatus && (
        <SubscriptionBanner
          status={subStatus}
          planId={subPlanId}
          periodEnd={subPeriodEnd}
          role={profile.role}
        />
      )}
      <DashboardShell user={profile as User} unreadCount={unreadCount}>
        {children}
      </DashboardShell>
    </>
  )
}
