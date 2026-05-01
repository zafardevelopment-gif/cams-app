'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import type { ActionResult, NotifType } from '@/types'
import {
  sendEmail,
  emailAssessmentAssigned,
  emailAssessmentResult,
  emailCertificateExpiry,
  emailSubscriptionExpiry,
  emailLicenseExpiry,
} from '@/lib/email'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifCategory =
  | 'assessments'
  | 'approvals'
  | 'transfers'
  | 'certificates'
  | 'billing'
  | 'system'

interface CreateNotifOptions {
  userId: string
  type: NotifType
  category: NotifCategory
  title: string
  body: string
  actionUrl?: string
  referenceId?: string
  referenceType?: string
}

// ─── Core: create one notification ───────────────────────────────────────────

export async function createNotification(opts: CreateNotifOptions): Promise<void> {
  const admin = createAdminClient()

  // Check user's in-app preference for this category
  const { data: prefs } = await admin
    .from('CAMS_notification_prefs')
    .select(`inapp_${opts.category}`)
    .eq('user_id', opts.userId)
    .single()

  const prefKey = `inapp_${opts.category}` as keyof typeof prefs
  const inappEnabled = prefs ? (prefs[prefKey] !== false) : true

  if (!inappEnabled) return

  await admin.from(T.notifications).insert({
    user_id:        opts.userId,
    type:           opts.type,
    category:       opts.category,
    title:          opts.title,
    body:           opts.body,
    action_url:     opts.actionUrl ?? null,
    reference_id:   opts.referenceId ?? null,
    reference_type: opts.referenceType ?? null,
    is_read:        false,
    email_sent:     false,
  })
}

// ─── Bulk: notify multiple users ──────────────────────────────────────────────

export async function notifyUsers(
  userIds: string[],
  opts: Omit<CreateNotifOptions, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return
  const admin = createAdminClient()

  const rows = userIds.map((userId) => ({
    user_id:        userId,
    type:           opts.type,
    category:       opts.category,
    title:          opts.title,
    body:           opts.body,
    action_url:     opts.actionUrl ?? null,
    reference_id:   opts.referenceId ?? null,
    reference_type: opts.referenceType ?? null,
    is_read:        false,
    email_sent:     false,
  }))

  await admin.from(T.notifications).insert(rows)
}

// ─── Notify hospital admin(s) of a hospital ──────────────────────────────────

export async function notifyHospitalAdmins(
  hospitalId: string,
  opts: Omit<CreateNotifOptions, 'userId'>
): Promise<void> {
  const admin = createAdminClient()
  const { data: admins } = await admin
    .from(T.users)
    .select('id')
    .eq('hospital_id', hospitalId)
    .eq('role', 'hospital_admin')
    .eq('status', 'active')

  const ids = (admins ?? []).map((u) => u.id)
  await notifyUsers(ids, opts)
}

// ─── Notify department heads / unit heads ─────────────────────────────────────

export async function notifyApprovers(
  hospitalId: string,
  roles: string[],
  opts: Omit<CreateNotifOptions, 'userId'>
): Promise<void> {
  const admin = createAdminClient()
  const { data: users } = await admin
    .from(T.users)
    .select('id')
    .eq('hospital_id', hospitalId)
    .in('role', roles)
    .eq('status', 'active')

  const ids = (users ?? []).map((u) => u.id)
  await notifyUsers(ids, opts)
}

// ─── Mark single notification read ───────────────────────────────────────────

export async function markNotificationRead(notifId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from(T.notifications)
    .update({ is_read: true })
    .eq('id', notifId)
    .eq('user_id', authUser.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Mark all read ────────────────────────────────────────────────────────────

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from(T.notifications)
    .update({ is_read: true })
    .eq('user_id', authUser.id)
    .eq('is_read', false)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Delete (clear) single notification ──────────────────────────────────────

export async function deleteNotification(notifId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from(T.notifications)
    .delete()
    .eq('id', notifId)
    .eq('user_id', authUser.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Clear all read notifications ─────────────────────────────────────────────

export async function clearReadNotifications(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from(T.notifications)
    .delete()
    .eq('user_id', authUser.id)
    .eq('is_read', true)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Get unread count (used by TopNav) ────────────────────────────────────────

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return 0

  const admin = createAdminClient()
  const { count } = await admin
    .from(T.notifications)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', authUser.id)
    .eq('is_read', false)

  return count ?? 0
}

// ─── Get notification preferences ─────────────────────────────────────────────

export async function getNotificationPrefs(): Promise<ActionResult<Record<string, boolean>>> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('CAMS_notification_prefs')
    .select('*')
    .eq('user_id', authUser.id)
    .single()

  return { success: true, data: data ?? {} }
}

// ─── Save notification preferences ────────────────────────────────────────────

export async function saveNotificationPrefs(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const categories: NotifCategory[] = ['assessments', 'approvals', 'transfers', 'certificates', 'billing', 'system']
  const channels = ['inapp', 'email'] as const

  const prefs: Record<string, boolean> = {}
  for (const ch of channels) {
    for (const cat of categories) {
      prefs[`${ch}_${cat}`] = formData.get(`${ch}_${cat}`) === 'on'
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('CAMS_notification_prefs')
    .upsert({ user_id: authUser.id, ...prefs }, { onConflict: 'user_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── System alert: pending approvals count ────────────────────────────────────

export async function sendPendingApprovalsAlert(hospitalId: string): Promise<void> {
  const admin = createAdminClient()

  const { count } = await admin
    .from(T.approvals)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (!count || count === 0) return

  await notifyHospitalAdmins(hospitalId, {
    type: 'warning',
    category: 'approvals',
    title: 'Pending Approvals',
    body: `You have ${count} assessment${count > 1 ? 's' : ''} awaiting your approval.`,
    actionUrl: '/head-nurse/approvals',
  })
}

// ─── System alert: subscription expiry ───────────────────────────────────────

export async function sendSubscriptionExpiryAlert(
  hospitalId: string,
  daysLeft: number
): Promise<void> {
  await notifyHospitalAdmins(hospitalId, {
    type: daysLeft <= 3 ? 'danger' : 'warning',
    category: 'billing',
    title: 'Subscription Expiring Soon',
    body: `Your subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew to avoid service interruption.`,
    actionUrl: '/billing',
  })
}

// ─── System alert: license expiry ────────────────────────────────────────────

export async function sendLicenseExpiryAlert(
  userId: string,
  userName: string,
  daysLeft: number
): Promise<void> {
  await createNotification({
    userId,
    type: daysLeft <= 7 ? 'danger' : 'warning',
    category: 'certificates',
    title: 'Nursing License Expiring',
    body: `Your nursing license expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Please renew it to stay compliant.`,
    actionUrl: '/settings',
    referenceType: 'user',
    referenceId: userId,
  })
}

// ─── Shared: check email pref for a user+category ────────────────────────────

async function isEmailPrefEnabled(userId: string, category: NotifCategory): Promise<boolean> {
  const admin = createAdminClient()
  const { data: prefs } = await admin
    .from('CAMS_notification_prefs')
    .select(`email_${category}`)
    .eq('user_id', userId)
    .single()
  if (!prefs) return true // default: enabled when no row exists
  const key = `email_${category}` as keyof typeof prefs
  return prefs[key] !== false
}

// ─── Shared: look up user id by email ────────────────────────────────────────

async function getUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('CAMS_users').select('id').eq('email', email).single()
  return data?.id ?? null
}

// ─── Email: assessment assigned ───────────────────────────────────────────────

export async function emailAssessmentAssignedNotif(
  staffEmail: string,
  staffName: string,
  templateTitle: string,
  assessmentId: string
): Promise<void> {
  const userId = await getUserIdByEmail(staffEmail)
  if (userId && !(await isEmailPrefEnabled(userId, 'assessments'))) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cams.sa'
  await sendEmail({
    to: staffEmail,
    subject: `New Assessment Assigned: ${templateTitle}`,
    html: emailAssessmentAssigned(staffName, templateTitle, `${appUrl}/assessments/${assessmentId}`),
  })
}

// ─── Email: assessment result ─────────────────────────────────────────────────

export async function emailAssessmentResultNotif(
  staffEmail: string,
  staffName: string,
  templateTitle: string,
  passed: boolean,
  score: number
): Promise<void> {
  const userId = await getUserIdByEmail(staffEmail)
  if (userId && !(await isEmailPrefEnabled(userId, 'assessments'))) return
  await sendEmail({
    to: staffEmail,
    subject: `Assessment Result: ${passed ? 'Passed ✅' : 'Not Passed ❌'} — ${templateTitle}`,
    html: emailAssessmentResult(staffName, templateTitle, passed, score),
  })
}

// ─── Email: certificate expiry ────────────────────────────────────────────────

export async function emailCertExpiryNotif(
  staffEmail: string,
  staffName: string,
  templateTitle: string,
  expiryDate: string,
  daysLeft: number
): Promise<void> {
  const userId = await getUserIdByEmail(staffEmail)
  if (userId && !(await isEmailPrefEnabled(userId, 'certificates'))) return
  await sendEmail({
    to: staffEmail,
    subject: `Certificate Expiring in ${daysLeft} days: ${templateTitle}`,
    html: emailCertificateExpiry(staffName, templateTitle, expiryDate, daysLeft),
  })
}

// ─── Email: subscription expiry ───────────────────────────────────────────────

export async function emailSubscriptionExpiryNotif(
  adminEmail: string,
  hospitalName: string,
  planName: string,
  expiryDate: string,
  daysLeft: number
): Promise<void> {
  const userId = await getUserIdByEmail(adminEmail)
  if (userId && !(await isEmailPrefEnabled(userId, 'billing'))) return
  await sendEmail({
    to: adminEmail,
    subject: `CAMS Subscription Expiring in ${daysLeft} days — ${hospitalName}`,
    html: emailSubscriptionExpiry(hospitalName, planName, expiryDate, daysLeft),
  })
}

// ─── Email: nursing license expiry ────────────────────────────────────────────

export async function emailLicenseExpiryNotif(
  staffEmail: string,
  staffName: string,
  expiryDate: string,
  daysLeft: number
): Promise<void> {
  const userId = await getUserIdByEmail(staffEmail)
  if (userId && !(await isEmailPrefEnabled(userId, 'certificates'))) return
  await sendEmail({
    to: staffEmail,
    subject: `Nursing License Expiring in ${daysLeft} days`,
    html: emailLicenseExpiry(staffName, expiryDate, daysLeft),
  })
}
