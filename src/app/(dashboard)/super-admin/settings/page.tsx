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

  const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name'] as const
  const { data: rows } = await admin
    .from(T.settings)
    .select('key, value')
    .in('key', [...SMTP_KEYS])

  const smtpCfg = Object.fromEntries(SMTP_KEYS.map((k) => [k, ''])) as Record<typeof SMTP_KEYS[number], string>
  for (const row of rows ?? []) {
    if (SMTP_KEYS.includes(row.key as typeof SMTP_KEYS[number])) {
      smtpCfg[row.key as typeof SMTP_KEYS[number]] = row.value ?? ''
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1>System Settings</h1>
          <p>Email and notification configuration</p>
        </div>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        SMTP Email Configuration
      </h3>

      <EmailConfigClient
        initialSmtp={smtpCfg}
        adminEmail={caller.email ?? authUser.email ?? ''}
      />
    </div>
  )
}
