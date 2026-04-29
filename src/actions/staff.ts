'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import {
  CreateUserSchema,
  EditUserSchema,
  ArchiveUserSchema,
  RequestTransferSchema,
  ProcessTransferSchema,
} from '@/lib/validations'
import type { ActionResult, UserRole } from '@/types'

// ── helpers ──────────────────────────────────────────────────────────────────

async function getManagerCaller() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null
  const admin = createAdminClient()
  const { data: caller } = await admin
    .from(T.users)
    .select('id, role, hospital_id')
    .eq('id', authUser.id)
    .single()
  const ALLOWED = ['super_admin', 'hospital_admin', 'branch_admin', 'hr_quality', 'head_nurse', 'department_head', 'unit_head']
  if (!caller || !ALLOWED.includes(caller.role)) return null
  return { authUser, admin, caller }
}

async function recordHistory(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  changedBy: string,
  fields: Array<{ field: string; oldVal: string | null | undefined; newVal: string | null | undefined }>
) {
  const rows = fields
    .filter((f) => String(f.oldVal ?? '') !== String(f.newVal ?? ''))
    .map((f) => ({
      user_id: userId,
      changed_by: changedBy,
      field_name: f.field,
      old_value: f.oldVal ? String(f.oldVal) : null,
      new_value: f.newVal ? String(f.newVal) : null,
    }))
  if (rows.length > 0) {
    await admin.from(T.profile_history).insert(rows)
  }
}

// ── CREATE USER ───────────────────────────────────────────────────────────────

export async function createUser(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getManagerCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    full_name:       formData.get('full_name'),
    email:           formData.get('email'),
    password:        formData.get('password'),
    role:            formData.get('role'),
    job_title:       formData.get('job_title'),
    phone:           formData.get('phone'),
    employee_id:     formData.get('employee_id'),
    nursing_license: formData.get('nursing_license'),
    license_expiry:  formData.get('license_expiry'),
    hired_date:      formData.get('hired_date'),
    department_id:   formData.get('department_id'),
    branch_id:       formData.get('branch_id'),
    unit_id:         formData.get('unit_id'),
  }

  const parsed = CreateUserSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const hospitalId = ctx.caller.role === 'super_admin'
    ? (formData.get('hospital_id') as string | null) ?? ctx.caller.hospital_id
    : ctx.caller.hospital_id

  if (!hospitalId) return { success: false, error: 'Hospital is required' }

  // Create auth user
  const { data: authData, error: authError } = await ctx.admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { role: parsed.data.role, full_name: parsed.data.full_name },
  })
  if (authError) {
    if (authError.message.includes('already been registered')) {
      return { success: false, error: 'An account with this email already exists.' }
    }
    return { success: false, error: authError.message }
  }

  // Create user profile
  const { data, error } = await ctx.admin.from(T.users).insert({
    id: authData.user.id,
    full_name:       parsed.data.full_name,
    email:           parsed.data.email,
    role:            parsed.data.role as UserRole,
    job_title:       parsed.data.job_title || null,
    phone:           parsed.data.phone || null,
    employee_id:     parsed.data.employee_id || null,
    nursing_license: parsed.data.nursing_license || null,
    license_expiry:  parsed.data.license_expiry || null,
    hired_date:      parsed.data.hired_date || null,
    hospital_id:     hospitalId,
    department_id:   parsed.data.department_id || null,
    branch_id:       parsed.data.branch_id || null,
    unit_id:         parsed.data.unit_id || null,
    status:          'active',
    approved_by:     ctx.authUser.id,
    approved_at:     new Date().toISOString(),
  }).select('id').single()

  if (error) {
    await ctx.admin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: error.message }
  }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'create_user',
    entity_type: 'user',
    entity_id: data.id,
    description: `Created user ${parsed.data.full_name} (${parsed.data.email}) as ${parsed.data.role}`,
  })

  revalidatePath('/staff-directory')
  return { success: true, data: { id: data.id } }
}

// ── EDIT USER ─────────────────────────────────────────────────────────────────

export async function editUser(userId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getManagerCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    full_name:       formData.get('full_name'),
    job_title:       formData.get('job_title'),
    phone:           formData.get('phone'),
    employee_id:     formData.get('employee_id'),
    nursing_license: formData.get('nursing_license'),
    license_expiry:  formData.get('license_expiry'),
    hired_date:      formData.get('hired_date'),
    role:            formData.get('role'),
    department_id:   formData.get('department_id'),
    branch_id:       formData.get('branch_id'),
    unit_id:         formData.get('unit_id'),
  }

  const parsed = EditUserSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Fetch current record to diff for history
  const { data: existing } = await ctx.admin
    .from(T.users)
    .select('full_name, job_title, phone, employee_id, nursing_license, license_expiry, hired_date, role, department_id, branch_id, unit_id, hospital_id')
    .eq('id', userId)
    .single()

  if (!existing) return { success: false, error: 'User not found' }
  if (ctx.caller.role !== 'super_admin' && existing.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot edit users outside your hospital' }
  }

  const { error } = await ctx.admin.from(T.users).update({
    full_name:       parsed.data.full_name,
    job_title:       parsed.data.job_title || null,
    phone:           parsed.data.phone || null,
    employee_id:     parsed.data.employee_id || null,
    nursing_license: parsed.data.nursing_license || null,
    license_expiry:  parsed.data.license_expiry || null,
    hired_date:      parsed.data.hired_date || null,
    role:            parsed.data.role as UserRole,
    department_id:   parsed.data.department_id || null,
    branch_id:       parsed.data.branch_id || null,
    unit_id:         parsed.data.unit_id || null,
  }).eq('id', userId)

  if (error) return { success: false, error: error.message }

  // Sync role to auth metadata if changed
  if (parsed.data.role !== existing.role) {
    await ctx.admin.auth.admin.updateUserById(userId, {
      user_metadata: { role: parsed.data.role },
    })
  }

  // Record diff in profile history
  await recordHistory(ctx.admin, userId, ctx.authUser.id, [
    { field: 'full_name',       oldVal: existing.full_name,       newVal: parsed.data.full_name },
    { field: 'job_title',       oldVal: existing.job_title,       newVal: parsed.data.job_title },
    { field: 'phone',           oldVal: existing.phone,           newVal: parsed.data.phone },
    { field: 'employee_id',     oldVal: existing.employee_id,     newVal: parsed.data.employee_id },
    { field: 'nursing_license', oldVal: existing.nursing_license, newVal: parsed.data.nursing_license },
    { field: 'license_expiry',  oldVal: existing.license_expiry,  newVal: parsed.data.license_expiry },
    { field: 'hired_date',      oldVal: existing.hired_date,      newVal: parsed.data.hired_date },
    { field: 'role',            oldVal: existing.role,            newVal: parsed.data.role },
    { field: 'department_id',   oldVal: existing.department_id,   newVal: parsed.data.department_id },
    { field: 'branch_id',       oldVal: existing.branch_id,       newVal: parsed.data.branch_id },
    { field: 'unit_id',         oldVal: existing.unit_id,         newVal: parsed.data.unit_id },
  ])

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'edit_user',
    entity_type: 'user',
    entity_id: userId,
    description: `Edited profile for user ${parsed.data.full_name}`,
  })

  revalidatePath(`/staff-directory/${userId}`)
  revalidatePath('/staff-directory')
  return { success: true }
}

// ── ARCHIVE / TERMINATE USER ──────────────────────────────────────────────────

export async function archiveUser(userId: string, reason: string): Promise<ActionResult> {
  const ctx = await getManagerCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = ArchiveUserSchema.safeParse({ userId, reason })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  if (parsed.data.userId === ctx.authUser.id) {
    return { success: false, error: 'You cannot archive your own account' }
  }

  const { data: target } = await ctx.admin
    .from(T.users)
    .select('hospital_id, full_name, status')
    .eq('id', parsed.data.userId)
    .single()

  if (!target) return { success: false, error: 'User not found' }
  if (ctx.caller.role !== 'super_admin' && target.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot archive users outside your hospital' }
  }
  if (target.status === 'inactive') {
    return { success: false, error: 'User is already archived' }
  }

  const { error } = await ctx.admin.from(T.users).update({
    status: 'inactive',
    archived_at: new Date().toISOString(),
    archived_by: ctx.authUser.id,
    termination_reason: reason,
  }).eq('id', parsed.data.userId)

  if (error) return { success: false, error: error.message }

  // Disable their Supabase auth login
  await ctx.admin.auth.admin.updateUserById(parsed.data.userId, { ban_duration: '876600h' })

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'archive_user',
    entity_type: 'user',
    entity_id: parsed.data.userId,
    description: `Archived user "${target.full_name}": ${reason}`,
    metadata: { reason },
  })

  revalidatePath('/staff-directory')
  revalidatePath(`/staff-directory/${parsed.data.userId}`)
  return { success: true }
}

export async function restoreUser(userId: string): Promise<ActionResult> {
  const ctx = await getManagerCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: target } = await ctx.admin
    .from(T.users)
    .select('hospital_id, full_name')
    .eq('id', userId)
    .single()

  if (!target) return { success: false, error: 'User not found' }
  if (ctx.caller.role !== 'super_admin' && target.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot restore users outside your hospital' }
  }

  const { error } = await ctx.admin.from(T.users).update({
    status: 'active',
    archived_at: null,
    archived_by: null,
    termination_reason: null,
  }).eq('id', userId)

  if (error) return { success: false, error: error.message }

  await ctx.admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'restore_user',
    entity_type: 'user',
    entity_id: userId,
    description: `Restored user "${target.full_name}"`,
  })

  revalidatePath('/staff-directory')
  return { success: true }
}

// ── RESET PASSWORD ────────────────────────────────────────────────────────────

export async function adminResetPassword(userId: string, newPassword: string): Promise<ActionResult> {
  const ctx = await getManagerCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }

  const { data: target } = await ctx.admin
    .from(T.users)
    .select('hospital_id, full_name')
    .eq('id', userId)
    .single()

  if (!target) return { success: false, error: 'User not found' }
  if (ctx.caller.role !== 'super_admin' && target.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot reset passwords for users outside your hospital' }
  }

  const { error } = await ctx.admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'admin_reset_password',
    entity_type: 'user',
    entity_id: userId,
    description: `Admin reset password for "${target.full_name}"`,
  })

  return { success: true }
}

// ── TRANSFER ──────────────────────────────────────────────────────────────────

export async function requestTransfer(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getManagerCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    staff_id:         formData.get('staff_id'),
    to_department_id: formData.get('to_department_id'),
    to_branch_id:     formData.get('to_branch_id'),
    to_hospital_id:   formData.get('to_hospital_id'),
    reason:           formData.get('reason'),
    effective_date:   formData.get('effective_date'),
  }

  const parsed = RequestTransferSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: staffUser } = await ctx.admin
    .from(T.users)
    .select('hospital_id, department_id, branch_id')
    .eq('id', parsed.data.staff_id)
    .single()

  if (!staffUser) return { success: false, error: 'Staff member not found' }
  if (ctx.caller.role !== 'super_admin' && staffUser.hospital_id !== ctx.caller.hospital_id) {
    return { success: false, error: 'Cannot transfer staff outside your hospital' }
  }

  const { data, error } = await ctx.admin.from(T.transfers).insert({
    staff_id:           parsed.data.staff_id,
    from_hospital_id:   staffUser.hospital_id,
    from_department_id: staffUser.department_id,
    to_hospital_id:     parsed.data.to_hospital_id || staffUser.hospital_id,
    to_department_id:   parsed.data.to_department_id || null,
    reason:             parsed.data.reason,
    effective_date:     parsed.data.effective_date || null,
    status:             'pending',
    requested_by:       ctx.authUser.id,
    head_nurse_approval: 'pending',
    admin_approval:      'pending',
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  // Notify the staff member
  await ctx.admin.from(T.notifications).insert({
    user_id: parsed.data.staff_id,
    type: 'info', category: 'transfers',
    title: 'Transfer Request Submitted',
    body: 'A transfer request has been submitted on your behalf. You will be notified when it is processed.',
    action_url: '/transfers',
    reference_id: data.id, reference_type: 'transfer',
  })

  // Notify hospital admins
  const { data: admins } = await ctx.admin
    .from(T.users)
    .select('id')
    .eq('hospital_id', staffUser.hospital_id ?? '')
    .in('role', ['hospital_admin', 'branch_admin', 'head_nurse', 'department_head'])
    .eq('status', 'active')
  if (admins && admins.length > 0) {
    await ctx.admin.from(T.notifications).insert(
      admins.map((a) => ({
        user_id: a.id,
        type: 'warning', category: 'transfers',
        title: 'New Transfer Request',
        body: 'A new staff transfer request requires your review.',
        action_url: '/transfers',
        reference_id: data.id, reference_type: 'transfer',
      }))
    )
  }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'request_transfer',
    entity_type: 'transfer',
    entity_id: data.id,
    description: `Transfer requested for staff ${parsed.data.staff_id}`,
  })

  revalidatePath('/transfers')
  return { success: true, data: { id: data.id } }
}

export async function processTransfer(
  transferId: string,
  action: 'approved' | 'rejected',
  notes?: string
): Promise<ActionResult> {
  const ctx = await getManagerCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = ProcessTransferSchema.safeParse({ transferId, action, notes })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: transfer } = await ctx.admin
    .from(T.transfers)
    .select('*')
    .eq('id', transferId)
    .single()

  if (!transfer) return { success: false, error: 'Transfer not found' }

  const isAdmin = ['super_admin', 'hospital_admin', 'branch_admin'].includes(ctx.caller.role)
  const isHeadNurse = ['head_nurse', 'department_head', 'unit_head'].includes(ctx.caller.role)

  // Head nurse approves first, then admin approves
  if (isHeadNurse && transfer.head_nurse_approval === 'pending') {
    await ctx.admin.from(T.transfers).update({
      head_nurse_approval: action,
      head_nurse_id: ctx.authUser.id,
      head_nurse_approved_at: new Date().toISOString(),
      notes,
      status: action === 'rejected' ? 'rejected' : 'pending',
    }).eq('id', transferId)
  } else if (isAdmin && transfer.head_nurse_approval === 'approved' && transfer.admin_approval === 'pending') {
    const finalStatus = action === 'approved' ? 'approved' : 'rejected'
    await ctx.admin.from(T.transfers).update({
      admin_approval: action,
      admin_id: ctx.authUser.id,
      admin_approved_at: new Date().toISOString(),
      notes,
      status: finalStatus,
    }).eq('id', transferId)

    // If fully approved — move the staff member
    if (action === 'approved') {
      await ctx.admin.from(T.users).update({
        department_id: transfer.to_department_id ?? undefined,
        hospital_id:   transfer.to_hospital_id ?? undefined,
      }).eq('id', transfer.staff_id)
    }
  } else {
    return { success: false, error: 'You are not authorized to process this transfer at this stage' }
  }

  // Notify the staff member of the outcome
  await ctx.admin.from(T.notifications).insert({
    user_id: transfer.staff_id,
    type: action === 'approved' ? 'success' : 'danger',
    category: 'transfers',
    title: action === 'approved' ? 'Transfer Approved' : 'Transfer Rejected',
    body: action === 'approved'
      ? 'Your transfer request has been approved. Your profile has been updated.'
      : `Your transfer request was not approved.${notes ? ` Reason: ${notes}` : ''}`,
    action_url: '/transfers',
    reference_id: transferId, reference_type: 'transfer',
  })

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: `transfer_${action}`,
    entity_type: 'transfer',
    entity_id: transferId,
    description: `Transfer ${action} by ${ctx.caller.role}`,
    metadata: { notes },
  })

  revalidatePath('/transfers')
  return { success: true }
}
