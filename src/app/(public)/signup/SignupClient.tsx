'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { submitHospitalSignup, validateCoupon } from '@/actions/billing'
import type { Plan } from '@/types'

const PLAN_COLORS: Record<string, string> = {
  trial:      '#E3F2FD',
  basic:      '#E8F5E9',
  pro:        '#EDE7F6',
  enterprise: '#FFF8E1',
}
const PLAN_ACCENT: Record<string, string> = {
  trial:      '#1565C0',
  basic:      '#2E7D32',
  pro:        '#6A1B9A',
  enterprise: '#F57F17',
}

const SA_REGIONS = [
  'Riyadh', 'Makkah', 'Madinah', 'Eastern Province', 'Asir', 'Tabuk',
  'Hail', 'Northern Borders', 'Jazan', 'Najran', 'Al Bahah', 'Al Jouf', 'Qassim',
]

export default function SignupClient({ plans }: { plans: Plan[] }) {
  const [step, setStep] = useState<'plan' | 'details' | 'success'>('plan')
  const [selectedPlan, setSelectedPlan] = useState<string>('trial')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [couponCode, setCouponCode] = useState('')
  const [couponInfo, setCouponInfo] = useState<{ discount_type: string; discount_value: number; description?: string } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [submittedId, setSubmittedId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [validatingCoupon, setValidatingCoupon] = useState(false)

  const selectedPlanObj = plans.find((p) => p.id === selectedPlan)

  function getPrice(plan: Plan) {
    const base = billingCycle === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly
    if (!couponInfo || selectedPlan !== plan.id) return base
    if (couponInfo.discount_type === 'percent') return base * (1 - couponInfo.discount_value / 100)
    return Math.max(0, base - couponInfo.discount_value)
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setValidatingCoupon(true)
    setCouponError('')
    setCouponInfo(null)
    const result = await validateCoupon(couponCode.trim(), selectedPlan)
    setValidatingCoupon(false)
    if (result.success && result.data) {
      setCouponInfo(result.data)
      toast.success('Coupon applied!')
    } else {
      setCouponError(result.error ?? 'Invalid coupon')
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('plan_id', selectedPlan)
    if (couponCode) fd.set('coupon_code', couponCode)

    startTransition(async () => {
      const result = await submitHospitalSignup(fd)
      if (result.success && result.data) {
        setSubmittedId(result.data.id)
        setStep('success')
      } else {
        toast.error(result.error ?? 'Submission failed')
      }
    })
  }

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(11,31,58,0.10)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0B1F3A', marginBottom: 8 }}>Request Submitted!</h2>
          <p style={{ color: '#6B8299', lineHeight: 1.7, marginBottom: 24 }}>
            Your hospital signup request has been received. Our team will review and activate your account within <strong>1 business day</strong>.
            You&apos;ll receive an email at the address you provided.
          </p>
          <div style={{ background: '#F0F4F8', borderRadius: 10, padding: '12px 20px', marginBottom: 24, fontSize: 13, color: '#3D5166' }}>
            Reference ID: <strong>{submittedId.slice(0, 8).toUpperCase()}</strong>
          </div>
          <Link href="/login" className="btn btn-primary" style={{ display: 'block' }}>Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0B1F3A 0%,#1565C0 60%,#0288D1 100%)', padding: '40px 16px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40, color: 'white' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.15)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏥</div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' }}>CAMS</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10 }}>Start Your Free Trial</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>
          Competency Assessment Management System — No credit card required
        </p>
        <div style={{ marginTop: 12, display: 'inline-flex', background: 'rgba(255,255,255,0.1)', borderRadius: 30, padding: 4 }}>
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setBillingCycle(c)}
              style={{
                padding: '6px 20px', borderRadius: 26, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: billingCycle === c ? 'white' : 'transparent',
                color: billingCycle === c ? '#0B1F3A' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s',
              }}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)} {c === 'yearly' && <span style={{ color: '#A5D6A7', fontSize: 11 }}>Save 17%</span>}
            </button>
          ))}
        </div>
      </div>

      {step === 'plan' && (
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 32 }}>
            {plans.map((plan) => {
              const price = getPrice(plan)
              const isSelected = selectedPlan === plan.id
              const isFree = plan.price_monthly === 0
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  style={{
                    background: isSelected ? PLAN_COLORS[plan.id] : 'white',
                    border: isSelected ? `2px solid ${PLAN_ACCENT[plan.id]}` : '2px solid transparent',
                    borderRadius: 14, padding: '24px 20px', cursor: 'pointer',
                    boxShadow: isSelected ? `0 4px 20px ${PLAN_ACCENT[plan.id]}22` : '0 2px 8px rgba(11,31,58,0.08)',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  {plan.id === 'pro' && (
                    <div style={{ position: 'absolute', top: -10, right: 16, background: '#6A1B9A', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Popular</div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0B1F3A', marginBottom: 6 }}>{plan.name}</div>
                  <div style={{ marginBottom: 14 }}>
                    {isFree ? (
                      <span style={{ fontSize: 22, fontWeight: 800, color: PLAN_ACCENT[plan.id] }}>Custom</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 26, fontWeight: 800, color: PLAN_ACCENT[plan.id] }}>
                          {couponInfo && selectedPlan === plan.id ? (
                            <span>
                              <span style={{ textDecoration: 'line-through', color: '#999', fontSize: 18 }}>SAR {Math.round(billingCycle === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly)}</span>{' '}
                              SAR {Math.round(price)}
                            </span>
                          ) : (
                            `SAR ${Math.round(price)}`
                          )}
                        </span>
                        <span style={{ color: '#6B8299', fontSize: 12 }}>/mo</span>
                      </>
                    )}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: '#3D5166' }}>
                    {plan.features.map((f, i) => (
                      <li key={i} style={{ paddingBottom: 4, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ color: PLAN_ACCENT[plan.id], flexShrink: 0 }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  {isSelected && (
                    <div style={{ marginTop: 14, textAlign: 'center', background: PLAN_ACCENT[plan.id], color: 'white', borderRadius: 8, padding: '6px 0', fontSize: 12, fontWeight: 600 }}>
                      Selected
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Coupon code */}
          <div style={{ maxWidth: 440, margin: '0 auto 24px', background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ color: 'white', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Have a coupon code?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); setCouponInfo(null) }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13, outline: 'none' }}
                onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
              />
              <button
                onClick={applyCoupon}
                disabled={validatingCoupon || !couponCode.trim()}
                style={{ background: 'white', color: '#1565C0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: validatingCoupon ? 0.6 : 1 }}
              >
                {validatingCoupon ? '…' : 'Apply'}
              </button>
            </div>
            {couponInfo && (
              <div style={{ marginTop: 8, color: '#A5D6A7', fontSize: 12 }}>
                ✅ {couponInfo.description ?? `${couponInfo.discount_value}${couponInfo.discount_type === 'percent' ? '%' : ' SAR'} discount applied`}
              </div>
            )}
            {couponError && <div style={{ marginTop: 8, color: '#FFCDD2', fontSize: 12 }}>⚠️ {couponError}</div>}
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => setStep('details')}
              style={{ background: 'white', color: '#1565C0', fontWeight: 700, fontSize: 15, padding: '12px 40px', borderRadius: 10, border: 'none', cursor: 'pointer' }}
            >
              Continue with {selectedPlanObj?.name} Plan →
            </button>
            <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              Already have an account? <Link href="/login" style={{ color: 'rgba(255,255,255,0.8)' }}>Sign in</Link>
            </div>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div style={{ maxWidth: 600, margin: '0 auto', background: 'white', borderRadius: 16, padding: '36px 40px', boxShadow: '0 8px 32px rgba(11,31,58,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <button onClick={() => setStep('plan')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B8299', fontSize: 20 }}>←</button>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0B1F3A' }}>Hospital Details</h2>
              <div style={{ fontSize: 12, color: '#6B8299' }}>
                Plan: <span style={{ fontWeight: 600, color: PLAN_ACCENT[selectedPlan] }}>{selectedPlanObj?.name}</span>
                {couponInfo && <span style={{ marginLeft: 8, color: '#2E7D32' }}>({couponInfo.discount_value}{couponInfo.discount_type === 'percent' ? '%' : ' SAR'} off)</span>}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Hospital Name (English) *</label>
                <input name="hospital_name" required className="form-input" placeholder="e.g. King Fahad Medical City" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Hospital Name (Arabic)</label>
                <input name="hospital_name_ar" className="form-input" placeholder="اسم المستشفى بالعربية" dir="rtl" />
              </div>
              <div>
                <label className="form-label">Region</label>
                <select name="region" className="form-input">
                  <option value="">Select region</option>
                  {SA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">City</label>
                <input name="city" className="form-input" placeholder="e.g. Riyadh" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="form-label">MOH License Number</label>
                <input name="license_number" className="form-input" placeholder="Optional — your hospital's MOH license" />
              </div>
              <hr style={{ gridColumn: '1/-1', border: 'none', borderTop: '1px solid #E2EAF0', margin: '4px 0' }} />
              <div>
                <label className="form-label">Contact Person Name *</label>
                <input name="contact_name" required className="form-input" placeholder="Full name" />
              </div>
              <div>
                <label className="form-label">Contact Email *</label>
                <input name="contact_email" required type="email" className="form-input" placeholder="admin@hospital.com" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Contact Phone</label>
                <input name="contact_phone" className="form-input" placeholder="+966 5X XXX XXXX" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Message (optional)</label>
                <textarea name="message" className="form-input" rows={3} placeholder="Any special requirements or notes for our team" style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={isPending}
                style={{ flex: 1, background: '#1565C0', color: 'white', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
              >
                {isPending ? 'Submitting…' : 'Submit Signup Request'}
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#6B8299', marginTop: 14 }}>
              By submitting, you agree to CAMS Terms of Service. Your account will be activated within 1 business day.
            </p>
          </form>
        </div>
      )}
    </div>
  )
}
