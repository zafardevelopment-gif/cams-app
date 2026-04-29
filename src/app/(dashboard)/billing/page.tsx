import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import { getHospitalBillingData, getPlans } from '@/actions/billing'
import BillingClient from './BillingClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Billing & Subscription — CAMS' }

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('hospital_id, role')
    .eq('id', authUser!.id)
    .single()

  const hospitalId = profile?.hospital_id ?? ''

  const [{ subscription, invoices }, plans, { data: hospital }] = await Promise.all([
    getHospitalBillingData(hospitalId),
    getPlans(),
    admin.from(T.hospitals).select('id, name, subscription_plan, subscription_expires_at').eq('id', hospitalId).single(),
  ])

  return (
    <BillingClient
      subscription={subscription}
      invoices={invoices}
      plans={plans}
      hospital={hospital}
      role={profile?.role ?? 'hospital_admin'}
    />
  )
}
