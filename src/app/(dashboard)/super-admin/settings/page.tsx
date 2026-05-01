import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import EmailConfigClient from './EmailConfigClient'

export default async function SuperAdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role, email').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') redirect('/login')

  const { data: rows } = await admin
    .from(T.settings)
    .select('key, value')
    .in('key', ['resend_api_key', 'email_from'])

  const resendKey = (rows?.find((r) => r.key === 'resend_api_key')?.value as string) ?? ''
  const emailFrom = (rows?.find((r) => r.key === 'email_from')?.value as string) ?? ''

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1>System Settings</h1>
          <p>Email and notification configuration</p>
        </div>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        Email Configuration
      </h3>

      <EmailConfigClient
        initialResendKey={resendKey}
        initialEmailFrom={emailFrom}
        adminEmail={caller.email ?? authUser.email ?? ''}
      />
    </div>
  )
}
