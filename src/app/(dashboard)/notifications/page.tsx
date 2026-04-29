import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import NotificationsClient from './NotificationsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications — CAMS' }

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: notifications } = await admin
    .from(T.notifications)
    .select('id, type, category, title, body, action_url, is_read, reference_id, reference_type, created_at')
    .eq('user_id', authUser!.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return <NotificationsClient notifications={notifications ?? []} />
}
