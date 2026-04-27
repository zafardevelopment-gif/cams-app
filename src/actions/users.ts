'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import {
  ApproveRegistrationSchema,
  RejectRegistrationSchema,
  UpdateUserStatusSchema,
} from '@/lib/validations'
import type { ActionResult, UserRole } from '@/types'

const VALID_ROLES: UserRole[] = [
  'staff', 'assessor', 'educator', 'head_nurse', 'unit_head',
  'department_head', 'hr_quality', 'branch_admin', 'hospital_admin', 'auditor',
]

export async function approveRegistration(registrationId: string, assignedRole?: UserRole): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const parsed = ApproveRegistrationSchema.safeParse({ registrationId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const admin = createAdminClient()

  const { data: reviewer } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser.id)
    .single()

  if (!reviewer || !['hospital_admin', 'super_admin', 'branch_admin'].includes(reviewer.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { data: req } = await admin
    .from(T.registration_requests)
    .select('*')
    .eq('id', registrationId)
    .single()

  if (!req) return { success: false, error: 'Registration request not found' }
  if (req.status !== 'pending') return { success: false, error: 'This request has already been reviewed' }

  // Non-super-admin can only approve requests for their own hospital
  if (reviewer.role !== 'super_admin' && req.hospital_id && req.hospital_id !== reviewer.hospital_id) {
    return { success: false, error: 'Cannot approve registrations for a different hospital' }
  }

  // Check if user profile already exists
  const { data: existingUser } = await admin
    .from(T.users)
    .select('id')
    .eq('id', req.supabase_user_id)
    .maybeSingle()

  if (existingUser) {
    return { success: false, error: 'User profile already exists for this registration' }
  }

  // Use admin-assigned role if provided and valid, otherwise fall back to requested role
  const finalRole: UserRole = (assignedRole && VALID_ROLES.includes(assignedRole))
    ? assignedRole
    : (req.role ?? 'staff')

  const { error: insertError } = await admin.from(T.users).insert({
    id: req.supabase_user_id,
    full_name: req.full_name,
    email: req.email,
    phone: req.phone,
    job_title: req.job_title,
    employee_id: req.employee_id,
    nursing_license: req.nursing_license,
    hospital_id: req.hospital_id ?? reviewer.hospital_id,
    branch_id: req.branch_id ?? null,
    department_id: req.department_id,
    role: finalRole,
    status: 'active',
    approved_by: authUser.id,
    approved_at: new Date().toISOString(),
  })

  if (insertError) return { success: false, error: insertError.message }

  await admin.from(T.registration_requests).update({
    status: 'approved',
    reviewed_by: authUser.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', registrationId)

  // Sync role into auth user metadata so middleware redirects correctly
  if (req.supabase_user_id) {
    await admin.auth.admin.updateUserById(req.supabase_user_id, {
      user_metadata: { role: finalRole, full_name: req.full_name },
    })
  }

  await admin.from(T.notifications).insert({
    user_id: req.supabase_user_id,
    type: 'success',
    category: 'registration',
    title: 'Account Approved',
    body: 'Your CAMS account has been approved. You can now sign in.',
    action_url: '/login',
  })

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'approve_registration',
    entity_type: 'registration_request',
    entity_id: registrationId,
    description: `Approved registration for ${req.full_name} (${req.email})`,
    metadata: { approved_user_id: req.supabase_user_id, role: finalRole },
  })

  revalidatePath('/hospital-admin/pending-registrations')
  revalidatePath('/super-admin')
  return { success: true }
}

export async function rejectRegistration(registrationId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const parsed = RejectRegistrationSchema.safeParse({ registrationId, reason })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const admin = createAdminClient()

  const { data: reviewer } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser.id)
    .single()

  if (!reviewer || !['hospital_admin', 'super_admin', 'branch_admin'].includes(reviewer.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { data: req } = await admin
    .from(T.registration_requests)
    .select('*')
    .eq('id', registrationId)
    .single()

  if (!req) return { success: false, error: 'Registration request not found' }
  if (req.status !== 'pending') return { success: false, error: 'This request has already been reviewed' }

  await admin.from(T.registration_requests).update({
    status: 'rejected',
    reviewed_by: authUser.id,
    reviewed_at: new Date().toISOString(),
    rejection_reason: parsed.data.reason,
  }).eq('id', registrationId)

  if (req.supabase_user_id) {
    await admin.from(T.notifications).insert({
      user_id: req.supabase_user_id,
      type: 'danger',
      category: 'registration',
      title: 'Account Request Not Approved',
      body: parsed.data.reason,
    })
  }

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'reject_registration',
    entity_type: 'registration_request',
    entity_id: registrationId,
    description: `Rejected registration for ${req.full_name} (${req.email})`,
    metadata: { reason: parsed.data.reason },
  })

  revalidatePath('/hospital-admin/pending-registrations')
  return { success: true }
}

export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended' | 'inactive'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const parsed = UpdateUserStatusSchema.safeParse({ userId, status })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const admin = createAdminClient()

  const { data: caller } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser.id)
    .single()

  if (!caller || !['hospital_admin', 'super_admin', 'branch_admin'].includes(caller.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Verify target user is in the same hospital
  const { data: targetUser } = await admin
    .from(T.users)
    .select('hospital_id, full_name')
    .eq('id', parsed.data.userId)
    .single()

  if (!targetUser) return { success: false, error: 'User not found' }

  if (caller.role !== 'super_admin' && targetUser.hospital_id !== caller.hospital_id) {
    return { success: false, error: 'Cannot modify users outside your hospital' }
  }

  // Prevent self-suspension
  if (parsed.data.userId === authUser.id && parsed.data.status === 'suspended') {
    return { success: false, error: 'You cannot suspend your own account' }
  }

  const { error } = await admin
    .from(T.users)
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.userId)

  if (error) return { success: false, error: error.message }

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: `user_status_${parsed.data.status}`,
    entity_type: 'user',
    entity_id: parsed.data.userId,
    description: `User "${targetUser.full_name}" status changed to ${parsed.data.status}`,
    metadata: { previous_status: null, new_status: parsed.data.status },
  })

  revalidatePath('/staff-directory')
  return { success: true }
}
