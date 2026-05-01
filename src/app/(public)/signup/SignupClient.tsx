'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { validateCoupon, completeHospitalSignup } from '@/actions/billing'
import type { Plan } from '@/types'

// ── colour helpers ────────────────────────────────────────────────────────────
const PLAN_BG: Record<string, string> = {
  trial: '#E3F2FD', basic: '#E8F5E9', pro: '#EDE7F6', enterprise: '#FFF8E1',
}
const PLAN_ACCENT: Record<string, string> = {
  trial: '#1565C0', basic: '#2E7D32', pro: '#6A1B9A', enterprise: '#F57F17',
}
const planAccent = (id: string) => PLAN_ACCENT[id] ?? '#1565C0'
const planBg     = (id: string) => PLAN_BG[id]     ?? '#E3F2FD'

const SA_REGIONS = [
  'Riyadh','Makkah','Madinah','Eastern Province','Asir','Tabuk',
  'Hail','Northern Borders','Jazan','Najran','Al Bahah','Al Jouf','Qassim',
]

type Step = 'plan' | 'details' | 'summary' | 'payment' | 'success'

interface CouponInfo {
  discount_type: string
  discount_value: number
  description?: string
}

// ── price helpers ─────────────────────────────────────────────────────────────
function calcDiscount(base: number, coupon: CouponInfo | null): number {
  if (!coupon) return 0
  if (coupon.discount_type === 'percent') return Math.round(base * coupon.discount_value / 100 * 100) / 100
  return Math.min(coupon.discount_value, base)
}

function fmt(n: number) { return n.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// ── step indicator ────────────────────────────────────────────────────────────
function StepBar({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'plan',    label: 'Select Plan' },
    { key: 'details', label: 'Your Details' },
    { key: 'summary', label: 'Review & Pay' },
    { key: 'success', label: 'Done' },
  ]
  const idx = steps.findIndex((s) => s.key === step || (step === 'payment' && s.key === 'summary'))
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
      {steps.map((s, i) => {
        const done    = i < idx
        const current = i === idx
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
                background: done ? '#4CAF50' : current ? 'white' : 'rgba(255,255,255,0.2)',
                color: done ? 'white' : current ? '#0B1F3A' : 'rgba(255,255,255,0.5)',
                border: current ? '2px solid white' : 'none',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: current ? 'white' : done ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', fontWeight: current ? 700 : 400, whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 48, height: 2, background: done ? '#4CAF50' : 'rgba(255,255,255,0.2)', margin: '0 6px', marginBottom: 20 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function SignupClient({ plans }: { plans: Plan[] }) {
  const [step, setStep] = useState<Step>('plan')
  const [selectedPlan, setSelectedPlan] = useState<string>(plans[0]?.id ?? 'trial')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  // coupon
  const [couponCode, setCouponCode]     = useState('')
  const [couponApplied, setCouponApplied] = useState('')
  const [couponInfo, setCouponInfo]     = useState<CouponInfo | null>(null)
  const [couponError, setCouponError]   = useState('')
  const [validatingCoupon, setValidating] = useState(false)

  // details form
  const [form, setForm] = useState({
    hospital_name: '', hospital_name_ar: '', city: '', region: '',
    license_number: '', contact_name: '', contact_email: '',
    contact_phone: '', admin_password: '', confirm_password: '', message: '',
  })
  const [formErrors, setFormErrors] = useState<Partial<typeof form>>({})

  // terms
  const [termsAccepted, setTermsAccepted]   = useState(false)
  const [billingAccepted, setBillingAccepted] = useState(false)

  // payment / result
  const [paymentPhase, setPaymentPhase]   = useState<'processing' | 'success'>('processing')
  const [transactionId, setTransactionId] = useState('')
  const [isPending, startTransition]      = useTransition()

  const plan = plans.find((p) => p.id === selectedPlan) ?? plans[0]

  const basePrice  = plan ? (billingCycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly)) : 0
  const discount   = calcDiscount(basePrice, couponInfo)
  const finalPrice = Math.max(0, basePrice - discount)
  const vat        = Math.round(finalPrice * 0.15 * 100) / 100
  const total      = finalPrice + vat
  const isFree     = basePrice === 0

  // ── coupon ────────────────────────────────────────────────────────────────
  async function applyCoupon() {
    if (!couponCode.trim()) return
    setValidating(true); setCouponError(''); setCouponInfo(null); setCouponApplied('')
    const result = await validateCoupon(couponCode.trim(), selectedPlan)
    setValidating(false)
    if (result.success && result.data) {
      setCouponInfo(result.data)
      setCouponApplied(couponCode.trim().toUpperCase())
      toast.success('Coupon applied!')
    } else {
      setCouponError(result.error ?? 'Invalid coupon')
    }
  }

  function clearCoupon() {
    setCouponCode(''); setCouponInfo(null); setCouponApplied(''); setCouponError('')
  }

  // ── form validation ───────────────────────────────────────────────────────
  function validateForm(): boolean {
    const errs: Partial<typeof form> = {}
    if (!form.hospital_name.trim() || form.hospital_name.trim().length < 2) errs.hospital_name = 'Required (min 2 chars)'
    if (!form.contact_name.trim() || form.contact_name.trim().length < 2)   errs.contact_name  = 'Required'
    if (!form.contact_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))            errs.contact_email = 'Valid email required'
    if (form.admin_password.length < 8)                                      errs.admin_password = 'Min 8 characters'
    if (form.admin_password !== form.confirm_password)                       errs.confirm_password = 'Passwords do not match'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── submit / mock payment ─────────────────────────────────────────────────
  function handleProceedToPayment() {
    if (!validateForm()) return
    setStep('summary')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleMockPayment() {
    setStep('payment')
    setPaymentPhase('processing')
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // After 2.5s simulate payment success + call server action
    setTimeout(() => {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (k !== 'confirm_password') fd.set(k, v) })
      fd.set('plan_id', selectedPlan)
      fd.set('billing_cycle', billingCycle)
      if (couponApplied) fd.set('coupon_code', couponApplied)
      fd.set('terms_accepted', 'true')

      startTransition(async () => {
        const result = await completeHospitalSignup(fd)
        if (result.success && result.data) {
          setTransactionId(result.data.transactionId)
          setPaymentPhase('success')
          setTimeout(() => setStep('success'), 1200)
        } else {
          toast.error(result.error ?? 'Signup failed. Please try again.')
          setStep('summary')
        }
      })
    }, 2500)
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // ── STEP: plan ────────────────────────────────────────────────────────────
  const planStep = (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      {/* Billing toggle */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.12)', borderRadius: 30, padding: 4 }}>
          {(['monthly', 'yearly'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setBillingCycle(c)} style={{
              padding: '7px 22px', borderRadius: 26, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: billingCycle === c ? 'white' : 'transparent',
              color: billingCycle === c ? '#0B1F3A' : 'rgba(255,255,255,0.65)',
              transition: 'all 0.2s',
            }}>
              {c === 'monthly' ? 'Monthly' : <>Yearly <span style={{ color: '#A5D6A7', fontSize: 11 }}>Save 17%</span></>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {plans.map((p) => {
          const price      = billingCycle === 'yearly' ? p.price_yearly / 12 : p.price_monthly
          const isSelected = selectedPlan === p.id
          const free       = p.price_monthly === 0
          return (
            <div key={p.id} onClick={() => { setSelectedPlan(p.id); clearCoupon() }} style={{
              background: isSelected ? planBg(p.id) : 'white',
              border: `2px solid ${isSelected ? planAccent(p.id) : 'transparent'}`,
              borderRadius: 14, padding: '24px 20px', cursor: 'pointer',
              boxShadow: isSelected ? `0 4px 20px ${planAccent(p.id)}22` : '0 2px 8px rgba(11,31,58,0.08)',
              transition: 'all 0.2s', position: 'relative',
            }}>
              {p.id === 'pro' && (
                <div style={{ position: 'absolute', top: -11, right: 16, background: '#6A1B9A', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Most Popular
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0B1F3A', marginBottom: 4 }}>{p.name}</div>
              {p.description && <div style={{ fontSize: 11, color: '#6B8299', marginBottom: 12, lineHeight: 1.4 }}>{p.description}</div>}
              <div style={{ marginBottom: 14 }}>
                {free ? (
                  <span style={{ fontSize: 22, fontWeight: 800, color: planAccent(p.id) }}>
                    {p.price_monthly === 0 && p.price_yearly === 0 ? 'Custom' : 'Free'}
                  </span>
                ) : (
                  <>
                    <span style={{ fontSize: 26, fontWeight: 800, color: planAccent(p.id) }}>SAR {Math.round(price)}</span>
                    <span style={{ color: '#6B8299', fontSize: 12 }}>/mo</span>
                    {billingCycle === 'yearly' && (
                      <div style={{ fontSize: 11, color: '#6B8299', marginTop: 2 }}>billed SAR {Math.round(p.price_yearly)}/yr</div>
                    )}
                  </>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: '#3D5166' }}>
                {p.features.map((f, i) => (
                  <li key={i} style={{ paddingBottom: 4, display: 'flex', gap: 6 }}>
                    <span style={{ color: planAccent(p.id), flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              {isSelected && (
                <div style={{ marginTop: 14, textAlign: 'center', background: planAccent(p.id), color: 'white', borderRadius: 8, padding: '6px 0', fontSize: 12, fontWeight: 600 }}>
                  ✓ Selected
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Coupon input */}
      <div style={{ maxWidth: 460, margin: '0 auto 28px', background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ color: 'white', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🎟️ Have a promotion code?</div>
        {couponInfo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(76,175,80,0.2)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(76,175,80,0.4)' }}>
            <span style={{ color: '#A5D6A7', fontSize: 20 }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{couponApplied}</div>
              <div style={{ color: '#A5D6A7', fontSize: 12 }}>
                {couponInfo.discount_type === 'percent' ? `${couponInfo.discount_value}% off` : `SAR ${couponInfo.discount_value} off`}
                {couponInfo.description && ` — ${couponInfo.description}`}
              </div>
            </div>
            <button type="button" onClick={clearCoupon} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" placeholder="Enter promotion code" value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }}
                onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                style={{ flex: 1, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '9px 13px', color: 'white', fontSize: 13, outline: 'none', letterSpacing: '0.05em' }}
              />
              <button type="button" onClick={applyCoupon} disabled={validatingCoupon || !couponCode.trim()} style={{ background: 'white', color: '#1565C0', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: validatingCoupon || !couponCode.trim() ? 0.5 : 1 }}>
                {validatingCoupon ? '…' : 'Apply'}
              </button>
            </div>
            {couponError && <div style={{ marginTop: 8, color: '#FFCDD2', fontSize: 12 }}>⚠️ {couponError}</div>}
          </>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button type="button" onClick={() => setStep('details')} style={{ background: 'white', color: '#1565C0', border: 'none', borderRadius: 10, padding: '13px 44px', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          Continue with {plan?.name} Plan →
        </button>
        <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          Already have an account? <Link href="/login" style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  )

  // ── STEP: details form ────────────────────────────────────────────────────
  function FieldErr({ k }: { k: keyof typeof formErrors }) {
    return formErrors[k] ? <div style={{ color: '#EF5350', fontSize: 11, marginTop: 3 }}>⚠ {formErrors[k]}</div> : null
  }

  const detailsStep = (
    <div style={{ maxWidth: 620, margin: '0 auto', background: 'white', borderRadius: 16, padding: '36px 40px', boxShadow: '0 8px 40px rgba(11,31,58,0.16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <button type="button" onClick={() => setStep('plan')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B8299', fontSize: 22 }}>←</button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0B1F3A', margin: 0 }}>Hospital & Admin Details</h2>
          <div style={{ fontSize: 12, color: '#6B8299', marginTop: 2 }}>
            Plan: <span style={{ fontWeight: 700, color: planAccent(selectedPlan) }}>{plan?.name}</span>
            {couponInfo && <span style={{ marginLeft: 8, color: '#2E7D32', fontWeight: 600 }}>+ coupon applied ✓</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Hospital info */}
        <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 11, color: '#6B8299', textTransform: 'uppercase', letterSpacing: '0.07em', paddingBottom: 4, borderBottom: '1px solid #E2EAF0' }}>
          🏥 Hospital Information
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Hospital Name (English) *</label>
          <input className="form-control" value={form.hospital_name} onChange={set('hospital_name')} placeholder="e.g. King Fahad Medical City" />
          <FieldErr k="hospital_name" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Hospital Name (Arabic)</label>
          <input className="form-control" value={form.hospital_name_ar} onChange={set('hospital_name_ar')} placeholder="اسم المستشفى" dir="rtl" />
        </div>
        <div>
          <label className="form-label">Region</label>
          <select className="form-control" value={form.region} onChange={set('region')}>
            <option value="">Select region</option>
            {SA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">City</label>
          <input className="form-control" value={form.city} onChange={set('city')} placeholder="e.g. Riyadh" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">MOH License Number</label>
          <input className="form-control" value={form.license_number} onChange={set('license_number')} placeholder="Optional" />
        </div>

        {/* Admin account */}
        <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 11, color: '#6B8299', textTransform: 'uppercase', letterSpacing: '0.07em', paddingBottom: 4, borderBottom: '1px solid #E2EAF0', marginTop: 8 }}>
          👤 Admin Account
        </div>
        <div>
          <label className="form-label">Admin Full Name *</label>
          <input className="form-control" value={form.contact_name} onChange={set('contact_name')} placeholder="Full name" />
          <FieldErr k="contact_name" />
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input className="form-control" value={form.contact_phone} onChange={set('contact_phone')} placeholder="+966 5X XXX XXXX" type="tel" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Email Address * <span style={{ fontSize: 11, color: '#6B8299' }}>(used to sign in)</span></label>
          <input className="form-control" value={form.contact_email} onChange={set('contact_email')} placeholder="admin@hospital.com" type="email" />
          <FieldErr k="contact_email" />
        </div>
        <div>
          <label className="form-label">Password * <span style={{ fontSize: 11, color: '#6B8299' }}>(min 8 chars)</span></label>
          <input className="form-control" value={form.admin_password} onChange={set('admin_password')} type="password" placeholder="Min 8 characters" />
          <FieldErr k="admin_password" />
        </div>
        <div>
          <label className="form-label">Confirm Password *</label>
          <input className="form-control" value={form.confirm_password} onChange={set('confirm_password')} type="password" placeholder="Repeat password" />
          <FieldErr k="confirm_password" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Message (optional)</label>
          <textarea className="form-control" rows={2} value={form.message} onChange={set('message')} placeholder="Any notes for our team" style={{ resize: 'vertical' }} />
        </div>
      </div>

      <button type="button" onClick={handleProceedToPayment} style={{ marginTop: 24, width: '100%', background: '#1565C0', color: 'white', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Review Order →
      </button>
    </div>
  )

  // ── STEP: summary ─────────────────────────────────────────────────────────
  const canPay = termsAccepted && billingAccepted

  const summaryStep = (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '32px 36px', boxShadow: '0 8px 40px rgba(11,31,58,0.16)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button type="button" onClick={() => setStep('details')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B8299', fontSize: 22 }}>←</button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0B1F3A', margin: 0 }}>Order Summary</h2>
        </div>

        {/* Plan badge */}
        <div style={{ background: planBg(selectedPlan), border: `1px solid ${planAccent(selectedPlan)}33`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: planAccent(selectedPlan), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 16 }}>
            {plan?.name?.[0] ?? 'P'}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0B1F3A' }}>{plan?.name} Plan</div>
            <div style={{ fontSize: 12, color: '#6B8299' }}>{billingCycle === 'yearly' ? 'Billed annually' : 'Billed monthly'} · {plan?.duration_days ?? 30} days</div>
          </div>
        </div>

        {/* Hospital info summary */}
        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B8299', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Account Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
            <div><span style={{ color: '#6B8299' }}>Hospital:</span> <strong>{form.hospital_name}</strong></div>
            <div><span style={{ color: '#6B8299' }}>Admin:</span> <strong>{form.contact_name}</strong></div>
            <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#6B8299' }}>Email:</span> <strong>{form.contact_email}</strong></div>
          </div>
        </div>

        {/* Price breakdown */}
        {!isFree && (
          <div style={{ borderTop: '1px solid #E2EAF0', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#3D5166', marginBottom: 8 }}>
              <span>{plan?.name} Plan ({billingCycle})</span>
              <span>SAR {fmt(basePrice)}</span>
            </div>
            {couponInfo && discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#2E7D32', marginBottom: 8 }}>
                <span>🎟️ Discount ({couponApplied})</span>
                <span>−SAR {fmt(discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#3D5166', marginBottom: 8 }}>
              <span>VAT (15%)</span>
              <span>SAR {fmt(vat)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#0B1F3A', paddingTop: 10, borderTop: '2px solid #E2EAF0', marginTop: 4 }}>
              <span>Total Due</span>
              <span>SAR {fmt(total)}</span>
            </div>
          </div>
        )}

        {isFree && (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 16, color: '#2E7D32', fontWeight: 700 }}>
            ✅ No payment required — Free {plan?.name} plan
          </div>
        )}
      </div>

      {/* Terms checkboxes */}
      <div style={{ background: 'white', borderRadius: 12, padding: '20px 24px', boxShadow: '0 4px 20px rgba(11,31,58,0.10)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0B1F3A', marginBottom: 12 }}>Before you proceed</div>
        {[
          { state: termsAccepted, set: setTermsAccepted, label: <>I agree to the <a href="#" style={{ color: '#1565C0' }}>Terms & Conditions</a> and <a href="#" style={{ color: '#1565C0' }}>Privacy Policy</a></> },
          { state: billingAccepted, set: setBillingAccepted, label: 'I accept subscription billing and understand the plan charges apply as shown above' },
        ].map((item, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={item.state} onChange={(e) => item.set(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#1565C0', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#3D5166', lineHeight: 1.5 }}>{item.label}</span>
          </label>
        ))}
      </div>

      <button type="button" onClick={handleMockPayment} disabled={!canPay || isPending} style={{
        width: '100%', background: canPay ? (isFree ? '#2E7D32' : '#1565C0') : '#B0BEC5',
        color: 'white', border: 'none', borderRadius: 12, padding: '15px 0',
        fontWeight: 700, fontSize: 16, cursor: canPay ? 'pointer' : 'not-allowed',
        boxShadow: canPay ? '0 4px 16px rgba(21,101,192,0.35)' : 'none',
        transition: 'all 0.2s',
      }}>
        {isFree ? '🚀 Activate Free Plan' : `💳 Pay SAR ${fmt(total)}`}
      </button>
      {!canPay && <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>Please accept both checkboxes to continue</div>}
    </div>
  )

  // ── STEP: payment (mock) ──────────────────────────────────────────────────
  const paymentStep = (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '48px 40px', boxShadow: '0 8px 40px rgba(11,31,58,0.16)', textAlign: 'center' }}>
        {paymentPhase === 'processing' ? (
          <>
            <div style={{ fontSize: 56, marginBottom: 20 }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}} .pay-spinner{display:inline-block;animation:spin 1s linear infinite;}`}</style>
              <span className="pay-spinner">⏳</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0B1F3A', marginBottom: 10 }}>Processing Payment…</h2>
            <p style={{ color: '#6B8299', fontSize: 14, lineHeight: 1.7 }}>
              Please do not close or refresh this page.<br />
              Securing your transaction…
            </p>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#1565C0', animation: `spin 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: '#B0BEC5' }}>Encrypted · Secure · PCI-DSS Compliant</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#2E7D32', marginBottom: 8 }}>Payment Successful!</h2>
            <div style={{ background: '#E8F5E9', borderRadius: 8, padding: '10px 20px', fontSize: 13, color: '#2E7D32', fontWeight: 600, letterSpacing: '0.04em' }}>
              Transaction ID: {transactionId}
            </div>
            <p style={{ color: '#6B8299', fontSize: 13, marginTop: 12 }}>Setting up your hospital account…</p>
          </>
        )}
      </div>
    </div>
  )

  // ── STEP: success ─────────────────────────────────────────────────────────
  const successStep = (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '48px 40px', boxShadow: '0 8px 40px rgba(11,31,58,0.16)', textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0B1F3A', marginBottom: 10 }}>Welcome to CAMS!</h2>
        <p style={{ color: '#6B8299', lineHeight: 1.8, fontSize: 15, marginBottom: 24 }}>
          Your hospital <strong style={{ color: '#0B1F3A' }}>{form.hospital_name}</strong> has been successfully activated on the <strong style={{ color: planAccent(selectedPlan) }}>{plan?.name} Plan</strong>.
        </p>

        <div style={{ background: '#F0F4F8', borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B8299', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Account Summary</div>
          {[
            ['Email', form.contact_email],
            ['Plan', `${plan?.name} (${billingCycle})`],
            ...(transactionId ? [['Transaction', transactionId]] : []),
            ...(!isFree ? [['Total Paid', `SAR ${fmt(total)}`]] : []),
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: '#6B8299' }}>{k}</span>
              <strong style={{ color: '#0B1F3A', fontFamily: k === 'Transaction' ? 'monospace' : undefined }}>{v}</strong>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/login" style={{ display: 'block', background: '#1565C0', color: 'white', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            → Go to Login
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: '#B0BEC5' }}>
          A confirmation email has been sent to <strong>{form.contact_email}</strong>
        </p>
      </div>
    </div>
  )

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0B1F3A 0%,#1565C0 60%,#0288D1 100%)', padding: '36px 16px 60px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32, color: 'white' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.15)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏥</div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' }}>CAMS</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, margin: '0 0 8px' }}>
          {step === 'plan' ? 'Choose Your Plan' : step === 'details' ? 'Create Your Account' : step === 'summary' ? 'Review & Confirm' : step === 'payment' ? 'Completing Setup' : '🎉 You\'re All Set!'}
        </h1>
        {step === 'plan' && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>Competency Assessment Management System · Start in minutes</p>}
      </div>

      {/* Step bar */}
      {step !== 'payment' && <StepBar step={step} />}

      {/* Content */}
      {step === 'plan'    && planStep}
      {step === 'details' && detailsStep}
      {step === 'summary' && summaryStep}
      {step === 'payment' && paymentStep}
      {step === 'success' && successStep}
    </div>
  )
}
