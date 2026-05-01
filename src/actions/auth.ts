'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardRoute } from '@/lib/utils'
import { T } from '@/lib/db'
import {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  UpdatePasswordSchema,
} from '@/lib/validations'
import { sendEmail } from '@/lib/email'
import type { ActionResult } from '@/types'

export async function login(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = LoginSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { success: false, error: msg }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Don't leak specific auth error details to client
    return { success: false, error: 'Invalid email or password.' }
  }

  const role = (data.user?.user_metadata?.role as string) ?? 'staff'

  // Update last_login_at using admin client (service-role, server-only)
  const admin = createAdminClient()
  await admin
    .from(T.users)
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id)

  // Log the login event
  await admin.from(T.activity_logs).insert({
    user_id: data.user.id,
    action: 'user_login',
    entity_type: 'user',
    entity_id: data.user.id,
    description: `User logged in`,
  })

  redirect(getDashboardRoute(role))
}

export async function register(formData: FormData): Promise<ActionResult<{ message: string }>> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
    hospital_id: formData.get('hospital_id'),
    department_id: formData.get('department_id'),
    job_title: formData.get('job_title'),
    phone: formData.get('phone'),
    employee_id: formData.get('employee_id'),
    nursing_license: formData.get('nursing_license'),
  }

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { success: false, error: msg }
  }

  // branch_id is optional — not in RegisterSchema so read it directly
  const branchId = (formData.get('branch_id') as string | null) || null

  const {
    email, password, full_name,
    hospital_id, department_id,
    job_title, phone, employee_id, nursing_license,
  } = parsed.data

  const admin = createAdminClient()

  // Check if email already exists in registration_requests
  const { data: existing } = await admin
    .from(T.registration_requests)
    .select('id, status')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'pending') {
      return { success: false, error: 'A registration request for this email is already pending review.' }
    }
    if (existing.status === 'approved') {
      return { success: false, error: 'An account with this email already exists. Please sign in.' }
    }
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'staff', full_name },
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return { success: false, error: 'An account with this email already exists.' }
    }
    return { success: false, error: 'Registration failed. Please try again.' }
  }

  const { error: reqError } = await admin.from(T.registration_requests).insert({
    full_name,
    email,
    phone: phone || null,
    job_title: job_title || null,
    employee_id: employee_id || null,
    nursing_license: nursing_license || null,
    hospital_id: hospital_id || null,
    branch_id: branchId,
    department_id: department_id || null,
    role: 'staff',
    status: 'pending',
    supabase_user_id: authData.user.id,
  })

  if (reqError) {
    // Clean up the auth user to avoid orphans
    await admin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Failed to submit registration. Please try again.' }
  }

  // Notify hospital admins of the new registration request
  if (hospital_id) {
    const { data: admins } = await admin
      .from(T.users)
      .select('id, email, full_name')
      .eq('hospital_id', hospital_id)
      .in('role', ['hospital_admin', 'branch_admin', 'hr_quality'])
      .eq('status', 'active')

    if (admins && admins.length > 0) {
      // In-app notifications
      await admin.from(T.notifications).insert(
        admins.map((a) => ({
          user_id: a.id,
          type: 'info',
          category: 'system',
          title: 'New Registration Request',
          body: `${full_name} (${email}) has submitted a registration request and is awaiting approval.`,
          action_url: '/hospital-admin/pending-registrations',
        }))
      )

      // Email notifications (fire-and-forget, no await on failure)
      const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/hospital-admin/pending-registrations`
      for (const a of admins) {
        sendEmail({
          to: a.email,
          subject: `New Registration Request — ${full_name}`,
          html: `
            <p>Hi <strong>${a.full_name}</strong>,</p>
            <p>A new staff member has submitted a registration request for your hospital:</p>
            <ul style="margin:12px 0;padding-left:20px;line-height:2">
              <li><strong>Name:</strong> ${full_name}</li>
              <li><strong>Email:</strong> ${email}</li>
              ${job_title ? `<li><strong>Job Title:</strong> ${job_title}</li>` : ''}
            </ul>
            <p>Please review and approve or reject this request.</p>
            <a href="${reviewUrl}" style="display:inline-block;padding:10px 22px;background:#1565C0;color:white;border-radius:8px;text-decoration:none;font-weight:700">Review Request →</a>
          `,
        }).catch(() => {/* email failure is non-fatal */})
      }
    }
  }

  return {
    success: true,
    data: { message: 'Registration submitted. An admin will review your request shortly.' },
  }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()

  // Get user before signing out so we can log the event
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const admin = createAdminClient()
    await admin.from(T.activity_logs).insert({
      user_id: user.id,
      action: 'user_logout',
      entity_type: 'user',
      entity_id: user.id,
      description: 'User logged out',
    })
  }

  await supabase.auth.signOut()
  redirect('/login')
}

export async function forgotPassword(formData: FormData): Promise<ActionResult<{ message: string }>> {
  const raw = { email: formData.get('email') }
  const parsed = ForgotPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid email' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  })

  // Always return success to prevent email enumeration
  if (error) {
    console.error('[forgotPassword]', error.message)
  }

  return {
    success: true,
    data: { message: 'If an account exists with that email, a password reset link has been sent.' },
  }
}

export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const raw = {
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
  }

  const parsed = UpdatePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Session expired. Please log in again.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { success: false, error: error.message }

  const admin = createAdminClient()
  await admin.from(T.activity_logs).insert({
    user_id: user.id,
    action: 'password_changed',
    entity_type: 'user',
    entity_id: user.id,
    description: 'User changed their password',
  })

  redirect('/login?message=password_updated')
}
