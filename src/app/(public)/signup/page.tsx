import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import SignupClient from './SignupClient'
import type { Plan } from '@/types'

export const metadata = { title: 'Get Started — CAMS' }

const DEFAULT_PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Free Trial',
    price_monthly: 0,
    price_yearly: 0,
    max_users: 20,
    max_branches: 1,
    max_departments: 3,
    features: ['Up to 20 staff', '3 departments', 'Core assessments', '14-day trial'],
    is_active: true,
    sort_order: 0,
    duration_days: 14,
    trial_days: 14,
    created_at: new Date().toISOString(),
  },
  {
    id: 'basic',
    name: 'Basic',
    price_monthly: 299,
    price_yearly: 2990,
    max_users: 100,
    max_branches: 2,
    max_departments: 10,
    features: ['Up to 100 staff', '2 branches', '10 departments', 'Full assessments', 'Reports'],
    is_active: true,
    sort_order: 1,
    duration_days: 365,
    trial_days: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 599,
    price_yearly: 5990,
    max_users: 500,
    max_branches: 10,
    max_departments: 50,
    features: ['Up to 500 staff', 'Unlimited branches', 'All features', 'Priority support', 'CBAHI reports'],
    is_active: true,
    sort_order: 2,
    duration_days: 365,
    trial_days: 0,
    created_at: new Date().toISOString(),
  },
]

export default async function SignupPage() {
  let plans: Plan[] = []
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from(T.plans)
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    plans = (data ?? []) as Plan[]
  } catch {
    // DB table not yet migrated — use defaults
  }

  return <SignupClient plans={plans.length > 0 ? plans : DEFAULT_PLANS} />
}
