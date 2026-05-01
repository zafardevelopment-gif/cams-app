'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { UpdateProfileSchema, ChangePasswordSchema } from '@/lib/validations'
import type { ActionResult } from '@/types'

// ─── Super-admin email configuration ─────────────────────────────────────────

export async function getEmailConfig(): Promise<ActionResult<{ resend_api_key: string; email_from: string }>> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Insufficient permissions' }

  const { data } = await admin
    .from(T.settings)
    .select('key, value')
    .in('key', ['resend_api_key', 'email_from'])
    .is('hospital_id', null)

  const cfg = { resend_api_key: '', email_from: '' }
  for (const row of data ?? []) {
    if (row.key === 'resend_api_key') cfg.resend_api_key = row.value ?? ''
    if (row.key === 'email_from') cfg.email_from = row.value ?? ''
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

  const resendKey = (formData.get('resend_api_key') as string | null)?.trim() ?? ''
  const emailFrom = (formData.get('email_from') as string | null)?.trim() ?? ''

  const keysToSet = [
    { key: 'resend_api_key', value: resendKey },
    { key: 'email_from', value: emailFrom },
  ]

  for (const row of keysToSet) {
    // Check if global (null hospital_id) setting exists
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
    description: 'Email configuration updated',
    metadata: { email_from: emailFrom },
  })

  revalidatePath('/super-admin/settings')
  return { success: true }
}

export async function sendTestEmail(toEmail: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: caller } = await admin.from(T.users).select('role').eq('id', authUser.id).single()
  if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Insufficient permissions' }

  // Read config from DB
  const { data: rows } = await admin
    .from(T.settings)
    .select('key, value')
    .in('key', ['resend_api_key', 'email_from'])
    .is('hospital_id', null)

  const dbKey = rows?.find((r) => r.key === 'resend_api_key')?.value ?? ''
  const dbFrom = rows?.find((r) => r.key === 'email_from')?.value ?? ''

  const apiKey = dbKey || process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'No RESEND_API_KEY configured' }

  const from = dbFrom || process.env.EMAIL_FROM || 'CAMS <noreply@cams.sa>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: toEmail,
        subject: 'CAMS Email Configuration Test',
        html: '<p>This is a test email from your CAMS email configuration. If you received this, email is working correctly.</p>',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Resend API error: ${text}` }
    }
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
