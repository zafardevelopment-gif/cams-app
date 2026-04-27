'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { UpdateProfileSchema, ChangePasswordSchema } from '@/lib/validations'
import type { ActionResult } from '@/types'

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
