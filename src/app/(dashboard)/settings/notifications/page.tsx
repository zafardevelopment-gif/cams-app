import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NotificationPrefsClient from './NotificationPrefsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notification Preferences — CAMS' }

export default async function NotificationPrefsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: prefs } = await admin
    .from('CAMS_notification_prefs')
    .select('*')
    .eq('user_id', authUser!.id)
    .single()

  return <NotificationPrefsClient prefs={prefs ?? {}} />
}
