import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import SignupClient from './SignupClient'
import type { Plan } from '@/types'

export const metadata = { title: 'Get Started — CAMS' }

export default async function SignupPage() {
  const admin = createAdminClient()
  const { data: plans } = await admin
    .from(T.plans)
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return <SignupClient plans={(plans ?? []) as Plan[]} />
}
