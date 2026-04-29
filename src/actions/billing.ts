'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'
import type { ActionResult, SubscriptionStatus } from '@/types'
import {
  HospitalSignupSchema,
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
  CreateCouponSchema,
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  ValidateCouponSchema,
} from '@/lib/validations'

// ─── Public: Hospital self-signup ─────────────────────────────────────────────

export async function submitHospitalSignup(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    hospital_name:    formData.get('hospital_name'),
    hospital_name_ar: formData.get('hospital_name_ar'),
    city:             formData.get('city'),
    region:           formData.get('region'),
    license_number:   formData.get('license_number'),
    contact_name:     formData.get('contact_name'),
    contact_email:    formData.get('contact_email'),
    contact_phone:    formData.get('contact_phone'),
    plan_id:          formData.get('plan_id'),
    coupon_code:      formData.get('coupon_code'),
    message:          formData.get('message'),
  }

  const parsed = HospitalSignupSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()

  // Validate coupon if provided
  if (parsed.data.coupon_code) {
    const { data: coupon } = await admin
      .from(T.coupons)
      .select('id, is_active, max_uses, used_count, valid_until, applies_to_plan')
      .eq('code', parsed.data.coupon_code.toUpperCase())
      .single()

    if (!coupon || !coupon.is_active) return { success: false, error: 'Invalid or expired coupon code' }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { success: false, error: 'Coupon has reached its usage limit' }
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { success: false, error: 'Coupon has expired' }
    if (coupon.applies_to_plan && coupon.applies_to_plan !== parsed.data.plan_id) {
      return { success: false, error: `This coupon is only valid for the ${coupon.applies_to_plan} plan` }
    }
  }

  const { data, error } = await admin.from(T.hospital_signups).insert({
    hospital_name:    parsed.data.hospital_name,
    hospital_name_ar: parsed.data.hospital_name_ar ?? null,
    city:             parsed.data.city ?? null,
    region:           parsed.data.region ?? null,
    license_number:   parsed.data.license_number ?? null,
    contact_name:     parsed.data.contact_name,
    contact_email:    parsed.data.contact_email,
    contact_phone:    parsed.data.contact_phone ?? null,
    plan_id:          parsed.data.plan_id,
    coupon_code:      parsed.data.coupon_code?.toUpperCase() ?? null,
    message:          parsed.data.message ?? null,
  }).select('id').single()

  if (error) return { success: false, error: 'Failed to submit signup request' }
  return { success: true, data: { id: data.id } }
}

// ─── Super Admin: Hospital signup management ──────────────────────────────────

export async function approveHospitalSignup(signupId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: signup } = await admin
    .from(T.hospital_signups)
    .select('*')
    .eq('id', signupId)
    .eq('status', 'pending')
    .single()

  if (!signup) return { success: false, error: 'Signup not found or already processed' }

  // Get plan to set max_users
  const { data: plan } = await admin.from(T.plans).select('max_users').eq('id', signup.plan_id).single()

  // Create hospital
  const { data: hospital, error: hErr } = await admin.from(T.hospitals).insert({
    name:              signup.hospital_name,
    name_ar:           signup.hospital_name_ar ?? null,
    city:              signup.city ?? null,
    region:            signup.region ?? null,
    license_number:    signup.license_number ?? null,
    contact_email:     signup.contact_email,
    contact_phone:     signup.contact_phone ?? null,
    subscription_plan: signup.plan_id,
    max_users:         plan?.max_users ?? 20,
    is_active:         true,
    cbahi_accredited:  false,
    primary_color:     '#1565C0',
  }).select('id').single()

  if (hErr || !hospital) return { success: false, error: 'Failed to create hospital account' }

  // Create subscription (trial = 14 days, paid = 30 days)
  const trialDays = signup.plan_id === 'trial' ? 14 : 30
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + trialDays)

  const subStatus: SubscriptionStatus = signup.plan_id === 'trial' ? 'trial' : 'active'

  // Resolve coupon
  let couponId: string | null = null
  if (signup.coupon_code) {
    const { data: coupon } = await admin.from(T.coupons).select('id, used_count').eq('code', signup.coupon_code).single()
    if (coupon) {
      couponId = coupon.id
      await admin.from(T.coupons).update({ used_count: coupon.used_count + 1 }).eq('id', coupon.id)
    }
  }

  await admin.from(T.subscriptions).insert({
    hospital_id:          hospital.id,
    plan_id:              signup.plan_id,
    status:               subStatus,
    billing_cycle:        'monthly',
    trial_ends_at:        signup.plan_id === 'trial' ? periodEnd.toISOString() : null,
    current_period_start: new Date().toISOString(),
    current_period_end:   periodEnd.toISOString(),
    coupon_id:            couponId,
    created_by:           authUser.id,
  })

  // Mark signup as approved
  await admin.from(T.hospital_signups).update({
    status:       'approved',
    reviewed_by:  authUser.id,
    reviewed_at:  new Date().toISOString(),
    hospital_id:  hospital.id,
  }).eq('id', signupId)

  // Log
  await admin.from(T.activity_logs).insert({
    user_id:     authUser.id,
    action:      'approve_hospital_signup',
    entity_type: 'hospital',
    entity_id:   hospital.id,
    description: `Approved hospital signup: ${signup.hospital_name}`,
  })

  return { success: true }
}

export async function rejectHospitalSignup(signupId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin.from(T.hospital_signups).update({
    status:           'rejected',
    reviewed_by:      authUser.id,
    reviewed_at:      new Date().toISOString(),
    rejection_reason: reason,
  }).eq('id', signupId).eq('status', 'pending')

  if (error) return { success: false, error: 'Failed to reject signup' }
  return { success: true }
}

// ─── Super Admin: Subscription management ────────────────────────────────────

export async function createSubscription(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Not authenticated' }

  const raw = {
    hospital_id:   formData.get('hospital_id'),
    plan_id:       formData.get('plan_id'),
    billing_cycle: formData.get('billing_cycle'),
    status:        formData.get('status'),
    notes:         formData.get('notes'),
  }
  const parsed = CreateSubscriptionSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()

  // Check if subscription already exists
  const { data: existing } = await admin.from(T.subscriptions).select('id').eq('hospital_id', parsed.data.hospital_id).single()
  if (existing) return { success: false, error: 'This hospital already has a subscription. Use update instead.' }

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + (parsed.data.billing_cycle === 'yearly' ? 12 : 1))

  const { data, error } = await admin.from(T.subscriptions).insert({
    hospital_id:          parsed.data.hospital_id,
    plan_id:              parsed.data.plan_id,
    status:               parsed.data.status,
    billing_cycle:        parsed.data.billing_cycle,
    current_period_start: new Date().toISOString(),
    current_period_end:   periodEnd.toISOString(),
    notes:                parsed.data.notes ?? null,
    created_by:           authUser.id,
  }).select('id').single()

  if (error) return { success: false, error: 'Failed to create subscription' }
  return { success: true, data: { id: data.id } }
}

export async function updateSubscription(subId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Not authenticated' }

  const raw = {
    plan_id:         formData.get('plan_id'),
    billing_cycle:   formData.get('billing_cycle'),
    status:          formData.get('status'),
    period_end:      formData.get('period_end'),
    price_override:  formData.get('price_override'),
    notes:           formData.get('notes'),
  }
  const parsed = UpdateSubscriptionSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}

  if (parsed.data.plan_id)        updates.plan_id       = parsed.data.plan_id
  if (parsed.data.billing_cycle)  updates.billing_cycle = parsed.data.billing_cycle
  if (parsed.data.status)         updates.status        = parsed.data.status
  if (parsed.data.period_end)     updates.current_period_end = new Date(parsed.data.period_end).toISOString()
  if (parsed.data.price_override !== undefined && parsed.data.price_override !== null)
    updates.price_override = parsed.data.price_override
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  if (parsed.data.status === 'cancelled') updates.cancelled_at = new Date().toISOString()

  const { error } = await admin.from(T.subscriptions).update(updates).eq('id', subId)
  if (error) return { success: false, error: 'Failed to update subscription' }

  await admin.from(T.activity_logs).insert({
    user_id:     authUser.id,
    action:      'update_subscription',
    entity_type: 'subscription',
    entity_id:   subId,
    description: `Updated subscription`,
  })

  return { success: true }
}

export async function cancelSubscription(subId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin.from(T.subscriptions).update({
    status:        'cancelled',
    cancelled_at:  new Date().toISOString(),
    cancel_reason: reason,
  }).eq('id', subId)

  if (error) return { success: false, error: 'Failed to cancel subscription' }
  return { success: true }
}

// ─── Coupon management ────────────────────────────────────────────────────────

export async function createCoupon(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Not authenticated' }

  const raw = {
    code:            formData.get('code'),
    description:     formData.get('description'),
    discount_type:   formData.get('discount_type'),
    discount_value:  formData.get('discount_value'),
    applies_to_plan: formData.get('applies_to_plan'),
    max_uses:        formData.get('max_uses'),
    valid_until:     formData.get('valid_until'),
  }
  const parsed = CreateCouponSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()

  // Check unique code
  const { data: existing } = await admin.from(T.coupons).select('id').eq('code', parsed.data.code.toUpperCase()).single()
  if (existing) return { success: false, error: 'Coupon code already exists' }

  const { data, error } = await admin.from(T.coupons).insert({
    code:            parsed.data.code.toUpperCase(),
    description:     parsed.data.description ?? null,
    discount_type:   parsed.data.discount_type,
    discount_value:  parsed.data.discount_value,
    applies_to_plan: parsed.data.applies_to_plan ?? null,
    max_uses:        parsed.data.max_uses ?? null,
    valid_until:     parsed.data.valid_until ? new Date(parsed.data.valid_until).toISOString() : null,
    created_by:      authUser.id,
  }).select('id').single()

  if (error) return { success: false, error: 'Failed to create coupon' }
  return { success: true, data: { id: data.id } }
}

export async function toggleCoupon(couponId: string, isActive: boolean): Promise<ActionResult> {
  const admin = createAdminClient()
  const { error } = await admin.from(T.coupons).update({ is_active: isActive }).eq('id', couponId)
  if (error) return { success: false, error: 'Failed to update coupon' }
  return { success: true }
}

export async function validateCoupon(code: string, planId: string): Promise<ActionResult<{ discount_type: string; discount_value: number; description?: string }>> {
  const parsed = ValidateCouponSchema.safeParse({ code, plan_id: planId })
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const admin = createAdminClient()
  const { data: coupon } = await admin
    .from(T.coupons)
    .select('id, discount_type, discount_value, description, max_uses, used_count, valid_until, applies_to_plan, is_active')
    .eq('code', code.toUpperCase())
    .single()

  if (!coupon || !coupon.is_active) return { success: false, error: 'Invalid or inactive coupon' }
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { success: false, error: 'Coupon usage limit reached' }
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { success: false, error: 'Coupon has expired' }
  if (coupon.applies_to_plan && coupon.applies_to_plan !== planId) return { success: false, error: `Coupon only applies to the ${coupon.applies_to_plan} plan` }

  return { success: true, data: { discount_type: coupon.discount_type, discount_value: coupon.discount_value, description: coupon.description ?? undefined } }
}

// ─── Invoice management ───────────────────────────────────────────────────────

export async function createInvoice(formData: FormData): Promise<ActionResult<{ id: string; invoice_number: string }>> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Not authenticated' }

  const raw = {
    hospital_id:     formData.get('hospital_id'),
    subscription_id: formData.get('subscription_id'),
    plan_id:         formData.get('plan_id'),
    amount:          formData.get('amount'),
    tax:             formData.get('tax'),
    payment_method:  formData.get('payment_method'),
    period_start:    formData.get('period_start'),
    period_end:      formData.get('period_end'),
    notes:           formData.get('notes'),
  }
  const parsed = CreateInvoiceSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()

  // Generate invoice number via DB function
  const { data: numData } = await admin.rpc('cams_next_invoice_number')
  const invoiceNumber = numData as string ?? `INV-${Date.now()}`

  const tax = parsed.data.tax ?? 0
  const total = parsed.data.amount + tax

  const { data, error } = await admin.from(T.invoices).insert({
    invoice_number:  invoiceNumber,
    hospital_id:     parsed.data.hospital_id,
    subscription_id: parsed.data.subscription_id ?? null,
    plan_id:         parsed.data.plan_id ?? null,
    amount:          parsed.data.amount,
    tax,
    total,
    status:          'pending',
    payment_method:  parsed.data.payment_method ?? null,
    period_start:    parsed.data.period_start ? new Date(parsed.data.period_start).toISOString() : null,
    period_end:      parsed.data.period_end ? new Date(parsed.data.period_end).toISOString() : null,
    notes:           parsed.data.notes ?? null,
    created_by:      authUser.id,
  }).select('id, invoice_number').single()

  if (error) return { success: false, error: 'Failed to create invoice' }
  return { success: true, data: { id: data.id, invoice_number: data.invoice_number } }
}

export async function markInvoicePaid(invoiceId: string, paymentRef?: string): Promise<ActionResult> {
  const admin = createAdminClient()
  const { error } = await admin.from(T.invoices).update({
    status:      'paid',
    paid_at:     new Date().toISOString(),
    payment_ref: paymentRef ?? null,
  }).eq('id', invoiceId)

  if (error) return { success: false, error: 'Failed to mark invoice as paid' }
  return { success: true }
}

export async function updateInvoiceStatus(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const raw = { status: formData.get('status'), payment_ref: formData.get('payment_ref'), notes: formData.get('notes') }
  const parsed = UpdateInvoiceSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'paid') updates.paid_at = new Date().toISOString()
  if (parsed.data.payment_ref) updates.payment_ref = parsed.data.payment_ref
  if (parsed.data.notes) updates.notes = parsed.data.notes

  const { error } = await admin.from(T.invoices).update(updates).eq('id', invoiceId)
  if (error) return { success: false, error: 'Failed to update invoice' }
  return { success: true }
}

// ─── Read: Super Admin analytics ─────────────────────────────────────────────

export async function getBillingDashboardData() {
  const admin = createAdminClient()

  const [{ data: subs }, { data: invoices }, { data: signups }] = await Promise.all([
    admin.from(T.subscriptions).select(`id, status, plan_id, current_period_end, hospital:${J.hospitals}!hospital_id(id, name)`),
    admin.from(T.invoices).select('id, total, status, paid_at, created_at'),
    admin.from(T.hospital_signups).select('id, status, created_at, hospital_name, plan_id').order('created_at', { ascending: false }).limit(10),
  ])

  const s = subs ?? []
  const inv = invoices ?? []

  const totalPaying    = s.filter((x) => x.status === 'active').length
  const activeTrials   = s.filter((x) => x.status === 'trial').length
  const suspended      = s.filter((x) => x.status === 'suspended').length
  const cancelled      = s.filter((x) => x.status === 'cancelled').length

  const now = new Date()
  const expiredPlans = s.filter((x) => x.current_period_end && new Date(x.current_period_end) < now && !['cancelled'].includes(x.status)).length

  const paidInvoices  = inv.filter((i) => i.status === 'paid')
  const totalRevenue  = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0)

  // Monthly revenue (last 6 months)
  const monthlyRevenue: { month: string; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const y = d.getFullYear()
    const m = d.getMonth()
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    const revenue = paidInvoices
      .filter((inv) => { const pd = new Date(inv.paid_at ?? inv.created_at); return pd.getFullYear() === y && pd.getMonth() === m })
      .reduce((sum, inv) => sum + Number(inv.total), 0)
    monthlyRevenue.push({ month: label, revenue })
  }

  const planBreakdown = s.reduce<Record<string, number>>((acc, sub) => {
    acc[sub.plan_id] = (acc[sub.plan_id] ?? 0) + 1
    return acc
  }, {})

  const pendingSignups = (signups ?? []).filter((x) => x.status === 'pending').length

  return {
    totalPaying,
    activeTrials,
    suspended,
    cancelled,
    expiredPlans,
    totalRevenue,
    monthlyRevenue,
    planBreakdown,
    pendingSignups,
    recentSignups: signups ?? [],
    allSubscriptions: s,
  }
}

export async function getHospitalBillingData(hospitalId: string) {
  const admin = createAdminClient()

  const [{ data: sub }, { data: invoices }] = await Promise.all([
    admin.from(T.subscriptions)
      .select(`*, plan:${J.plans}!plan_id(*)`)
      .eq('hospital_id', hospitalId)
      .single(),
    admin.from(T.invoices)
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false }),
  ])

  return { subscription: sub, invoices: invoices ?? [] }
}

export async function getPlans() {
  const admin = createAdminClient()
  const { data } = await admin.from(T.plans).select('*').eq('is_active', true).order('sort_order')
  return data ?? []
}

export async function getSubscriptions(hospitalId?: string) {
  const admin = createAdminClient()
  let q = admin.from(T.subscriptions)
    .select(`*, hospital:${J.hospitals}!hospital_id(id, name, contact_email), plan:${J.plans}!plan_id(id, name, price_monthly)`)
    .order('created_at', { ascending: false })

  if (hospitalId) q = q.eq('hospital_id', hospitalId)
  const { data } = await q
  return data ?? []
}

export async function getHospitalSignups(status?: string) {
  const admin = createAdminClient()
  let q = admin.from(T.hospital_signups)
    .select(`*, plan:${J.plans}!plan_id(id, name)`)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  const { data } = await q
  return data ?? []
}

export async function getCoupons() {
  const admin = createAdminClient()
  const { data } = await admin.from(T.coupons).select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function getInvoices(hospitalId?: string) {
  const admin = createAdminClient()
  let q = admin.from(T.invoices)
    .select(`*, hospital:${J.hospitals}!hospital_id(id, name)`)
    .order('created_at', { ascending: false })
    .limit(200)

  if (hospitalId) q = q.eq('hospital_id', hospitalId)
  const { data } = await q
  return data ?? []
}
