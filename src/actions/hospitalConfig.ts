'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { parseConfig, SETTINGS_KEY, type HospitalConfig, type ApprovalRole } from '@/lib/hospitalConfig'
import type { ActionResult } from '@/types'

async function getAdminCaller() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser.id)
    .single()

  if (!caller || caller.role !== 'hospital_admin') return null
  return { authUser, admin, hospitalId: caller.hospital_id as string }
}

/** Read config for a hospital (called server-side from layout/pages). */
export async function getHospitalConfig(hospitalId: string): Promise<HospitalConfig> {
  const admin = createAdminClient()
  const { data } = await admin
    .from(T.settings)
    .select('value')
    .eq('hospital_id', hospitalId)
    .eq('key', SETTINGS_KEY)
    .single()

  return parseConfig(data?.value)
}

/** Save the full config. hospital_admin only. */
export async function saveHospitalConfig(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const config: HospitalConfig = {
    hasBranches:    formData.get('hasBranches') === 'true',
    hasDepartments: formData.get('hasDepartments') === 'true',
    hasUnits:       formData.get('hasUnits') === 'true',
    approvalRoles:  (formData.getAll('approvalRoles') as string[]).filter(Boolean) as ApprovalRole[],
  }

  // Ensure at least hospital_admin is always in the chain
  if (!config.approvalRoles.includes('hospital_admin')) {
    config.approvalRoles.push('hospital_admin')
  }

  // Upsert into settings table
  const { error } = await ctx.admin
    .from(T.settings)
    .upsert(
      {
        hospital_id: ctx.hospitalId,
        key: SETTINGS_KEY,
        value: config,
        updated_by: ctx.authUser.id,
      },
      { onConflict: 'hospital_id,key' },
    )

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'update_hospital_config',
    entity_type: 'hospital',
    entity_id: ctx.hospitalId,
    description: 'Updated hospital structure & workflow configuration',
  })

  revalidatePath('/settings')
  revalidatePath('/hospital-admin')
  return { success: true }
}
