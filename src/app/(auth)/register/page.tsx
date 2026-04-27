import { RegisterForm } from '@/components/auth/RegisterForm'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Request Access — CAMS' }

export default async function RegisterPage() {
  const admin = createAdminClient()
  const { data: hospitals } = await admin
    .from(T.hospitals)
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return <RegisterForm hospitals={hospitals ?? []} />
}
