import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardRoute } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user.user_metadata?.role ?? 'staff'
  redirect(getDashboardRoute(role))
}
