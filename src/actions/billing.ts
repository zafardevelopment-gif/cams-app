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
  CreatePlanSchema,
  UpdatePlanSchema,
  CompleteSignupSchema,
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
  if (!parsed.success) return { success: false, error: 'Invalid coupon code' }

  const admin = createAdminClient()
  const { data: coupon } = await admin
    .from(T.coupons)
    .select('id, discount_type, discount_value, description, max_uses, used_count, valid_until, applies_to_plan, is_active')
    .eq('code', code.toUpperCase())
    .single()

  if (!coupon || !coupon.is_active) return { success: false, error: 'Invalid or inactive coupon code' }
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { success: false, error: 'This coupon has reached its usage limit' }
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { success: false, error: 'This coupon has expired' }
  if (coupon.applies_to_plan && coupon.applies_to_plan !== planId) {
    return { success: false, error: `This coupon only applies to the ${coupon.applies_to_plan} plan` }
  }

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

export async function getAllPlans() {
  const admin = createAdminClient()
  const { data } = await admin.from(T.plans).select('*').order('sort_order')
  return data ?? []
}

// ─── Plan CRUD (Super Admin) ──────────────────────────────────────────────────

async function getSuperAdminCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return null
  return { userId: user.id, admin }
}

export async function createPlan(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getSuperAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    id:              formData.get('id'),
    name:            formData.get('name'),
    name_ar:         formData.get('name_ar'),
    description:     formData.get('description'),
    price_monthly:   formData.get('price_monthly'),
    price_yearly:    formData.get('price_yearly'),
    max_users:       formData.get('max_users'),
    max_branches:    formData.get('max_branches'),
    max_departments: formData.get('max_departments'),
    duration_days:   formData.get('duration_days'),
    trial_days:      formData.get('trial_days'),
    sort_order:      formData.get('sort_order'),
    features:        formData.get('features'),
  }
  const parsed = CreatePlanSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Parse features JSON string
  let features: string[] = []
  if (parsed.data.features) {
    try { features = JSON.parse(parsed.data.features) } catch { features = parsed.data.features.split('\n').map((f) => f.trim()).filter(Boolean) }
  }

  const { data: existing } = await ctx.admin.from(T.plans).select('id').eq('id', parsed.data.id).single()
  if (existing) return { success: false, error: 'A plan with this ID already exists' }

  const { data, error } = await ctx.admin.from(T.plans).insert({
    id:              parsed.data.id,
    name:            parsed.data.name,
    name_ar:         parsed.data.name_ar || null,
    description:     parsed.data.description || null,
    price_monthly:   parsed.data.price_monthly,
    price_yearly:    parsed.data.price_yearly,
    max_users:       parsed.data.max_users,
    max_branches:    parsed.data.max_branches,
    max_departments: parsed.data.max_departments,
    duration_days:   parsed.data.duration_days,
    trial_days:      parsed.data.trial_days,
    sort_order:      parsed.data.sort_order,
    features,
    is_active:       true,
  }).select('id').single()

  if (error) return { success: false, error: 'Failed to create plan: ' + error.message }
  return { success: true, data: { id: data.id } }
}

export async function updatePlan(planId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getSuperAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    name:            formData.get('name'),
    name_ar:         formData.get('name_ar'),
    description:     formData.get('description'),
    price_monthly:   formData.get('price_monthly'),
    price_yearly:    formData.get('price_yearly'),
    max_users:       formData.get('max_users'),
    max_branches:    formData.get('max_branches'),
    max_departments: formData.get('max_departments'),
    duration_days:   formData.get('duration_days'),
    trial_days:      formData.get('trial_days'),
    sort_order:      formData.get('sort_order'),
    features:        formData.get('features'),
    is_active:       formData.get('is_active'),
  }
  const parsed = UpdatePlanSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const updates: Record<string, unknown> = {}
  if (parsed.data.name !== undefined)            updates.name            = parsed.data.name
  if (parsed.data.name_ar !== undefined)         updates.name_ar         = parsed.data.name_ar || null
  if (parsed.data.description !== undefined)     updates.description     = parsed.data.description || null
  if (parsed.data.price_monthly !== undefined)   updates.price_monthly   = parsed.data.price_monthly
  if (parsed.data.price_yearly !== undefined)    updates.price_yearly    = parsed.data.price_yearly
  if (parsed.data.max_users !== undefined)       updates.max_users       = parsed.data.max_users
  if (parsed.data.max_branches !== undefined)    updates.max_branches    = parsed.data.max_branches
  if (parsed.data.max_departments !== undefined) updates.max_departments = parsed.data.max_departments
  if (parsed.data.duration_days !== undefined)   updates.duration_days   = parsed.data.duration_days
  if (parsed.data.trial_days !== undefined)      updates.trial_days      = parsed.data.trial_days
  if (parsed.data.sort_order !== undefined)      updates.sort_order      = parsed.data.sort_order
  if (parsed.data.is_active !== undefined)       updates.is_active       = parsed.data.is_active
  if (parsed.data.features) {
    try { updates.features = JSON.parse(parsed.data.features) }
    catch { updates.features = parsed.data.features.split('\n').map((f: string) => f.trim()).filter(Boolean) }
  }

  const { error } = await ctx.admin.from(T.plans).update(updates).eq('id', planId)
  if (error) return { success: false, error: 'Failed to update plan' }
  return { success: true }
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const ctx = await getSuperAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  // Prevent deleting plans that have active subscriptions
  const { count } = await ctx.admin.from(T.subscriptions).select('id', { count: 'exact', head: true }).eq('plan_id', planId).neq('status', 'cancelled')
  if ((count ?? 0) > 0) return { success: false, error: 'Cannot delete a plan with active subscriptions. Deactivate it instead.' }

  const { error } = await ctx.admin.from(T.plans).delete().eq('id', planId)
  if (error) return { success: false, error: 'Failed to delete plan' }
  return { success: true }
}

// ─── Delete hospital ─────────────────────────────────────────────────────────

export async function deleteHospital(hospitalId: string): Promise<ActionResult> {
  const ctx = await getSuperAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  // Check for active staff users
  const { count: userCount } = await ctx.admin
    .from(T.users)
    .select('id', { count: 'exact', head: true })
    .eq('hospital_id', hospitalId)
    .eq('status', 'active')

  if ((userCount ?? 0) > 0) {
    return { success: false, error: `Cannot delete: hospital has ${userCount} active staff. Suspend it instead.` }
  }

  const { error } = await ctx.admin.from(T.hospitals).delete().eq('id', hospitalId)
  if (error) return { success: false, error: 'Failed to delete hospital: ' + error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.userId,
    action: 'delete_hospital',
    entity_type: 'hospital',
    entity_id: hospitalId,
    description: 'Hospital deleted by super admin',
  })

  return { success: true }
}

// ─── Self-service signup: complete payment + provision hospital ───────────────

/** Called after mock payment success. Creates hospital, admin user, subscription, invoice. */
export async function completeHospitalSignup(formData: FormData): Promise<ActionResult<{ transactionId: string; hospitalId: string }>> {
  const raw = {
    hospital_name:    formData.get('hospital_name'),
    hospital_name_ar: formData.get('hospital_name_ar'),
    city:             formData.get('city'),
    region:           formData.get('region'),
    license_number:   formData.get('license_number'),
    contact_name:     formData.get('contact_name'),
    contact_email:    formData.get('contact_email'),
    contact_phone:    formData.get('contact_phone'),
    admin_password:   formData.get('admin_password'),
    plan_id:          formData.get('plan_id'),
    billing_cycle:    formData.get('billing_cycle'),
    coupon_code:      formData.get('coupon_code'),
    message:          formData.get('message'),
    terms_accepted:   formData.get('terms_accepted'),
  }

  const parsed = CompleteSignupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { success: false, error: `${issue?.path?.join('.') ?? 'field'}: ${issue?.message ?? 'Invalid input'}` }
  }

  const admin = createAdminClient()

  // Check duplicate email via CAMS_users table (faster than listing all auth users)
  const { data: existingProfile } = await admin.from(T.users).select('id').eq('email', parsed.data.contact_email).maybeSingle()
  if (existingProfile) return { success: false, error: 'An account with this email already exists. Please sign in instead.' }

  // Load plan
  const { data: plan } = await admin.from(T.plans).select('*').eq('id', parsed.data.plan_id).eq('is_active', true).single()
  if (!plan) return { success: false, error: 'Selected plan is not available' }

  // Validate & apply coupon
  let couponId: string | null = null
  let discountAmount = 0
  const basePrice = parsed.data.billing_cycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly)

  if (parsed.data.coupon_code) {
    const { data: coupon } = await admin
      .from(T.coupons)
      .select('id, discount_type, discount_value, max_uses, used_count, valid_until, applies_to_plan, is_active')
      .eq('code', parsed.data.coupon_code.toUpperCase())
      .single()

    if (!coupon || !coupon.is_active) return { success: false, error: 'Invalid or expired coupon code' }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { success: false, error: 'Coupon has reached its usage limit' }
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { success: false, error: 'Coupon has expired' }
    if (coupon.applies_to_plan && coupon.applies_to_plan !== parsed.data.plan_id) {
      return { success: false, error: `This coupon only applies to the ${coupon.applies_to_plan} plan` }
    }

    couponId = coupon.id
    if (coupon.discount_type === 'percent') {
      discountAmount = Math.round(basePrice * coupon.discount_value / 100 * 100) / 100
    } else {
      discountAmount = Math.min(coupon.discount_value, basePrice)
    }
  }

  const finalAmount = Math.max(0, basePrice - discountAmount)

  // 1. Create Supabase Auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email:             parsed.data.contact_email,
    password:          parsed.data.admin_password,
    email_confirm:     true,
    user_metadata:     { full_name: parsed.data.contact_name, role: 'hospital_admin' },
  })
  if (authErr || !authData.user) return { success: false, error: authErr?.message ?? 'Failed to create admin account' }

  const authUserId = authData.user.id

  // 2. Create hospital
  const { data: hospital, error: hErr } = await admin.from(T.hospitals).insert({
    name:              parsed.data.hospital_name,
    name_ar:           parsed.data.hospital_name_ar || null,
    city:              parsed.data.city || null,
    region:            parsed.data.region || null,
    license_number:    parsed.data.license_number || null,
    contact_email:     parsed.data.contact_email,
    contact_phone:     parsed.data.contact_phone || null,
    subscription_plan: parsed.data.plan_id,
    max_users:         plan.max_users,
    is_active:         true,
    cbahi_accredited:  false,
    primary_color:     '#1565C0',
  }).select('id').single()

  if (hErr || !hospital) {
    // Rollback: delete auth user
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: 'Failed to create hospital account' }
  }

  // 3. Create user profile record
  await admin.from(T.users).insert({
    id:          authUserId,
    hospital_id: hospital.id,
    full_name:   parsed.data.contact_name,
    email:       parsed.data.contact_email,
    phone:       parsed.data.contact_phone || null,
    role:        'hospital_admin',
    status:      'active',
  })

  // 4. Calculate subscription period
  const durationDays = plan.duration_days ?? 30
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + durationDays)

  const subStatus: SubscriptionStatus = plan.price_monthly === 0 ? 'trial' : 'active'

  // Generate mock transaction ID
  const transactionId = `CAMS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  // 5. Create subscription
  const { data: sub } = await admin.from(T.subscriptions).insert({
    hospital_id:          hospital.id,
    plan_id:              parsed.data.plan_id,
    status:               subStatus,
    billing_cycle:        parsed.data.billing_cycle,
    trial_ends_at:        subStatus === 'trial' ? periodEnd.toISOString() : null,
    current_period_start: new Date().toISOString(),
    current_period_end:   periodEnd.toISOString(),
    coupon_id:            couponId,
    gateway:              'mock',
    gateway_sub_id:       transactionId,
    notes:                `Self-service signup. Mock payment. Tx: ${transactionId}`,
  }).select('id').single()

  // 6. Increment coupon usage
  if (couponId) {
    const { data: c } = await admin.from(T.coupons).select('used_count').eq('id', couponId).single()
    if (c) await admin.from(T.coupons).update({ used_count: c.used_count + 1 }).eq('id', couponId)
  }

  // 7. Create invoice (only for paid plans)
  if (finalAmount > 0 && sub) {
    const { data: numData } = await admin.rpc('cams_next_invoice_number')
    const invoiceNumber = (numData as string) ?? `INV-${Date.now()}`
    const tax = Math.round(finalAmount * 0.15 * 100) / 100  // 15% VAT
    await admin.from(T.invoices).insert({
      invoice_number:  invoiceNumber,
      hospital_id:     hospital.id,
      subscription_id: sub.id,
      plan_id:         parsed.data.plan_id,
      amount:          finalAmount,
      tax,
      total:           finalAmount + tax,
      status:          'paid',
      payment_method:  'mock',
      payment_ref:     transactionId,
      paid_at:         new Date().toISOString(),
      period_start:    new Date().toISOString(),
      period_end:      periodEnd.toISOString(),
      notes:           'Mock payment — self-service signup',
    })
  }

  // 8. Record signup for audit trail (non-critical — ignore insert errors)
  await admin.from(T.hospital_signups).insert({
    hospital_name:    parsed.data.hospital_name,
    hospital_name_ar: parsed.data.hospital_name_ar || null,
    city:             parsed.data.city || null,
    region:           parsed.data.region || null,
    license_number:   parsed.data.license_number || null,
    contact_name:     parsed.data.contact_name,
    contact_email:    parsed.data.contact_email,
    contact_phone:    parsed.data.contact_phone || null,
    plan_id:          parsed.data.plan_id,
    coupon_code:      parsed.data.coupon_code?.toUpperCase() || null,
    message:          parsed.data.message || null,
    status:           'approved',
    hospital_id:      hospital.id,
    reviewed_at:      new Date().toISOString(),
    payment_ref:      transactionId,
    payment_status:   'paid',
    final_amount:     finalAmount,
    discount_amount:  discountAmount,
    billing_cycle:    parsed.data.billing_cycle,
    terms_accepted:   true,
    terms_accepted_at: new Date().toISOString(),
  })

  return { success: true, data: { transactionId, hospitalId: hospital.id } }
}

// ─── Hospital: Request plan upgrade ──────────────────────────────────────────

export async function requestPlanUpgrade(
  newPlanId: string,
  billingCycle: 'monthly' | 'yearly'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from(T.users)
    .select('role, hospital_id, full_name, email')
    .eq('id', authUser.id)
    .single()

  if (!caller || !['hospital_admin', 'super_admin'].includes(caller.role)) {
    return { success: false, error: 'Only hospital admins can request plan upgrades' }
  }

  const { data: plan } = await admin
    .from(T.plans)
    .select('id, name')
    .eq('id', newPlanId)
    .single()

  if (!plan) return { success: false, error: 'Plan not found' }

  const { data: hospital } = await admin
    .from(T.hospitals)
    .select('id, name, subscription_plan')
    .eq('id', caller.hospital_id ?? '')
    .single()

  if (!hospital) return { success: false, error: 'Hospital not found' }

  // Notify all super admins via in-app notification
  const { data: superAdmins } = await admin
    .from(T.users)
    .select('id')
    .eq('role', 'super_admin')
    .eq('status', 'active')

  if (superAdmins && superAdmins.length > 0) {
    await admin.from(T.notifications).insert(
      superAdmins.map((sa) => ({
        user_id: sa.id,
        type: 'info',
        category: 'billing',
        title: 'Plan Upgrade Request',
        body: `${hospital.name} (admin: ${caller.full_name}) has requested an upgrade to the ${plan.name} plan (${billingCycle}).`,
        action_url: '/super-admin/subscriptions',
      }))
    )
  }

  // Log the request
  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'request_plan_upgrade',
    entity_type: 'hospital',
    entity_id: hospital.id,
    description: `${hospital.name} requested upgrade to ${plan.name} plan (${billingCycle})`,
    metadata: {
      from_plan: hospital.subscription_plan,
      to_plan: newPlanId,
      billing_cycle: billingCycle,
      requester_email: caller.email,
    },
  })

  return { success: true }
}
