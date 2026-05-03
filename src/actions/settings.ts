'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { UpdateProfileSchema, ChangePasswordSchema } from '@/lib/validations'
import type { ActionResult } from '@/types'

// ─── Super-admin SMTP email configuration ────────────────────────────────────

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name'] as const
type SmtpKey = typeof SMTP_KEYS[number]

export async function getEmailConfig(): Promise<ActionResult<Record<SmtpKey, string>>> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Insufficient permissions' }

  const { data } = await admin
    .from(T.settings)
    .select('key, value')
    .in('key', [...SMTP_KEYS])
    .is('hospital_id', null)

  const cfg = Object.fromEntries(SMTP_KEYS.map((k) => [k, ''])) as Record<SmtpKey, string>
  for (const row of data ?? []) {
    if (SMTP_KEYS.includes(row.key as SmtpKey)) cfg[row.key as SmtpKey] = row.value ?? ''
  }
  return { success: true, data: cfg }
}

export async function saveEmailConfig(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Insufficient permissions' }

  const keysToSet = SMTP_KEYS.map((key) => ({
    key,
    value: (formData.get(key) as string | null)?.trim() ?? '',
  }))

  for (const row of keysToSet) {
    const { data: existing } = await admin
      .from(T.settings)
      .select('id')
      .is('hospital_id', null)
      .eq('key', row.key)
      .maybeSingle()

    if (existing) {
      await admin.from(T.settings).update({ value: row.value, updated_by: authUser.id, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await admin.from(T.settings).insert({ key: row.key, value: row.value, hospital_id: null, updated_by: authUser.id })
    }
  }

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'update_email_config',
    entity_type: 'settings',
    description: 'SMTP email configuration updated',
    metadata: { smtp_host: (formData.get('smtp_host') as string) ?? '' },
  })

  revalidatePath('/super-admin/settings')
  revalidatePath('/settings')
  return { success: true }
}

export async function sendTestEmail(toEmail: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Insufficient permissions' }

  // Use the same sendEmail function which reads SMTP config internally
  try {
    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: toEmail,
      subject: 'CAMS SMTP Configuration Test',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:32px auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px">
          <h2 style="color:#1565C0;margin-top:0">✅ SMTP Test Successful</h2>
          <p>This is a test email from your CAMS SMTP configuration.</p>
          <p>If you received this message, your SMTP settings are working correctly.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
          <p style="font-size:12px;color:#94a3b8">Sent at: ${new Date().toUTCString()}</p>
        </div>
      `,
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const raw = {
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
    job_title: formData.get('job_title'),
    nursing_license: formData.get('nursing_license'),
  }

  const parsed = UpdateProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const admin = createAdminClient()

  const { error } = await admin.from(T.users).update({
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    job_title: parsed.data.job_title || null,
    nursing_license: parsed.data.nursing_license || null,
  }).eq('id', authUser.id)

  if (error) return { success: false, error: error.message }

  // Keep auth user metadata in sync with profile changes
  await supabase.auth.updateUser({
    data: { full_name: parsed.data.full_name },
  })

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'update_profile',
    entity_type: 'user',
    entity_id: authUser.id,
    description: 'User updated their profile',
  })

  revalidatePath('/settings')
  return { success: true }
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const raw = {
    new_password: formData.get('new_password'),
    confirm_password: formData.get('confirm_password'),
  }

  const parsed = ChangePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Session expired. Please log in again.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password })
  if (error) return { success: false, error: error.message }

  const admin = createAdminClient()
  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'password_changed',
    entity_type: 'user',
    entity_id: authUser.id,
    description: 'User changed their password from settings',
  })

  return { success: true }
}
