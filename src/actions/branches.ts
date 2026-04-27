'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { BranchSchema, UnitSchema, UpdateDepartmentSchema } from '@/lib/validations'
import type { ActionResult } from '@/types'

// ── helpers ─────────────────────────────────────────────────────────────────

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

  if (!caller || !['hospital_admin', 'super_admin'].includes(caller.role)) return null
  return { authUser, admin, caller }
}

// ── BRANCHES ─────────────────────────────────────────────────────────────────

export async function createBranch(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    name: formData.get('name'),
    name_ar: formData.get('name_ar'),
    city: formData.get('city'),
    address: formData.get('address'),
    contact_email: formData.get('contact_email'),
    contact_phone: formData.get('contact_phone'),
  }

  const parsed = BranchSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const hospitalId = ctx.caller.role === 'super_admin'
    ? (formData.get('hospital_id') as string | null)
    : ctx.caller.hospital_id

  if (!hospitalId) return { success: false, error: 'Hospital is required' }

  const { data, error } = await ctx.admin.from(T.branches).insert({
    hospital_id: hospitalId,
    name: parsed.data.name,
    name_ar: parsed.data.name_ar || null,
    city: parsed.data.city || null,
    address: parsed.data.address || null,
    contact_email: parsed.data.contact_email || null,
    contact_phone: parsed.data.contact_phone || null,
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'create_branch',
    entity_type: 'branch',
    entity_id: data.id,
    description: `Created branch "${parsed.data.name}"`,
  })

  revalidatePath('/hospital/branches')
  return { success: true, data: { id: data.id } }
}

export async function updateBranch(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    name: formData.get('name'),
    name_ar: formData.get('name_ar'),
    city: formData.get('city'),
    address: formData.get('address'),
    contact_email: formData.get('contact_email'),
    contact_phone: formData.get('contact_phone'),
  }

  const parsed = BranchSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: existing } = await ctx.admin
    .from(T.branches)
    .select('hospital_id')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Branch not found' }
  if (ctx.caller.role === 'hospital_admin' && existing.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot edit branches from a different hospital' }
  }

  const { error } = await ctx.admin.from(T.branches).update({
    name: parsed.data.name,
    name_ar: parsed.data.name_ar || null,
    city: parsed.data.city || null,
    address: parsed.data.address || null,
    contact_email: parsed.data.contact_email || null,
    contact_phone: parsed.data.contact_phone || null,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'update_branch',
    entity_type: 'branch',
    entity_id: id,
    description: `Updated branch "${parsed.data.name}"`,
  })

  revalidatePath('/hospital/branches')
  return { success: true }
}

export async function toggleBranchStatus(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await ctx.admin
    .from(T.branches)
    .select('hospital_id, name')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Branch not found' }
  if (ctx.caller.role === 'hospital_admin' && existing.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot modify branches from a different hospital' }
  }

  const { error } = await ctx.admin.from(T.branches).update({ is_active: isActive }).eq('id', id)
  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: isActive ? 'activate_branch' : 'deactivate_branch',
    entity_type: 'branch',
    entity_id: id,
    description: `${isActive ? 'Activated' : 'Deactivated'} branch "${existing.name}"`,
  })

  revalidatePath('/hospital/branches')
  return { success: true }
}

// ── UNITS ─────────────────────────────────────────────────────────────────────

export async function createUnit(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    department_id: formData.get('department_id'),
    branch_id: formData.get('branch_id'),
    name: formData.get('name'),
    name_ar: formData.get('name_ar'),
    head_user_id: formData.get('head_user_id'),
  }

  const parsed = UnitSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Verify department belongs to caller's hospital
  const { data: dept } = await ctx.admin
    .from(T.departments)
    .select('hospital_id')
    .eq('id', parsed.data.department_id)
    .single()

  if (!dept) return { success: false, error: 'Department not found' }
  if (ctx.caller.role === 'hospital_admin' && dept.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Department belongs to a different hospital' }
  }

  const { data, error } = await ctx.admin.from(T.units).insert({
    department_id: parsed.data.department_id,
    hospital_id: dept.hospital_id,
    branch_id: parsed.data.branch_id || null,
    name: parsed.data.name,
    name_ar: parsed.data.name_ar || null,
    head_user_id: parsed.data.head_user_id || null,
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'create_unit',
    entity_type: 'unit',
    entity_id: data.id,
    description: `Created unit "${parsed.data.name}"`,
  })

  revalidatePath('/hospital/units')
  return { success: true, data: { id: data.id } }
}

export async function updateUnit(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    department_id: formData.get('department_id'),
    branch_id: formData.get('branch_id'),
    name: formData.get('name'),
    name_ar: formData.get('name_ar'),
    head_user_id: formData.get('head_user_id'),
  }

  const parsed = UnitSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: existing } = await ctx.admin
    .from(T.units)
    .select('hospital_id')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Unit not found' }
  if (ctx.caller.role === 'hospital_admin' && existing.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot edit units from a different hospital' }
  }

  const { error } = await ctx.admin.from(T.units).update({
    department_id: parsed.data.department_id,
    branch_id: parsed.data.branch_id || null,
    name: parsed.data.name,
    name_ar: parsed.data.name_ar || null,
    head_user_id: parsed.data.head_user_id || null,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'update_unit',
    entity_type: 'unit',
    entity_id: id,
    description: `Updated unit "${parsed.data.name}"`,
  })

  revalidatePath('/hospital/units')
  return { success: true }
}

export async function toggleUnitStatus(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await ctx.admin
    .from(T.units)
    .select('hospital_id, name')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Unit not found' }
  if (ctx.caller.role === 'hospital_admin' && existing.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot modify units from a different hospital' }
  }

  const { error } = await ctx.admin.from(T.units).update({ is_active: isActive }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/hospital/units')
  return { success: true }
}

// ── DEPARTMENTS (assign to branch) ───────────────────────────────────────────

export async function updateDepartment(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    name: formData.get('name'),
    name_ar: formData.get('name_ar'),
    branch_id: formData.get('branch_id'),
    head_nurse_id: formData.get('head_nurse_id'),
  }

  const parsed = UpdateDepartmentSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: existing } = await ctx.admin
    .from(T.departments)
    .select('hospital_id')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Department not found' }
  if (ctx.caller.role === 'hospital_admin' && existing.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot edit departments from a different hospital' }
  }

  const { error } = await ctx.admin.from(T.departments).update({
    name: parsed.data.name,
    name_ar: parsed.data.name_ar || null,
    branch_id: parsed.data.branch_id || null,
    head_nurse_id: parsed.data.head_nurse_id || null,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'update_department',
    entity_type: 'department',
    entity_id: id,
    description: `Updated department "${parsed.data.name}"`,
  })

  revalidatePath('/hospital/departments')
  return { success: true }
}
