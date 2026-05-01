'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { requestPlanUpgrade } from '@/actions/billing'
import type { Plan } from '@/types'

type Subscription = Awaited<ReturnType<typeof import('@/actions/billing').getHospitalBillingData>>['subscription']
type Invoice = Awaited<ReturnType<typeof import('@/actions/billing').getHospitalBillingData>>['invoices'][number]
type Hospital = { id: string; name: string; subscription_plan: string; subscription_expires_at?: string | null } | null

const PLAN_COLORS: Record<string, string> = {
  trial: '#E3F2FD', basic: '#E8F5E9', pro: '#EDE7F6', enterprise: '#FFF8E1',
}
const PLAN_ACCENT: Record<string, string> = {
  trial: '#1565C0', basic: '#2E7D32', pro: '#6A1B9A', enterprise: '#F57F17',
}
const STATUS_BADGE: Record<string, string> = {
  trial: 'badge-blue', active: 'badge-green', past_due: 'badge-yellow',
  suspended: 'badge-red', cancelled: 'badge-gray', read_only: 'badge-purple',
  paid: 'badge-green', pending: 'badge-yellow', void: 'badge-gray', refunded: 'badge-blue',
}

export default function BillingClient({
  subscription,
  invoices,
  plans,
  hospital,
}: {
  subscription: Subscription
  invoices: Invoice[]
  plans: Plan[]
  hospital: Hospital
  role: string
}) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [isPending, startTransition] = useTransition()

  const sub = subscription as (typeof subscription & { plan?: Plan | Plan[] }) | null
  const planRaw = sub?.plan
  const currentPlan = planRaw ? (Array.isArray(planRaw) ? planRaw[0] : planRaw) as Plan : null

  const isExpired = sub?.current_period_end && new Date(sub.current_period_end) < new Date()
  const daysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
    : null

  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const totalSpend = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Billing & Subscription</h1>
          <p>{hospital?.name ?? 'Your hospital account'}</p>
        </div>
        <div className="page-header-actions">
          {sub?.status !== 'cancelled' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowUpgrade(!showUpgrade)}>
              {showUpgrade ? '✕ Close' : '⬆️ Upgrade Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Current plan banner */}
      <div style={{
        background: currentPlan ? `linear-gradient(135deg, ${PLAN_ACCENT[currentPlan.id] ?? '#1565C0'} 0%, #0B1F3A 100%)` : 'linear-gradient(135deg,#0B1F3A,#1565C0)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20h20v20H20z' fill='white'/%3E%3C/svg%3E")` }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Current Plan</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{currentPlan?.name ?? hospital?.subscription_plan ?? '—'}</div>
          {sub?.billing_cycle && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Billed {sub.billing_cycle}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
          {[
            { label: 'Status', value: sub?.status ?? '—' },
            { label: 'Period Ends', value: sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-CA') : '—' },
            { label: 'Days Left', value: isExpired ? 'Expired' : daysLeft != null ? `${daysLeft}d` : '—' },
            { label: 'Max Users', value: currentPlan?.max_users ?? '—' },
          ].map((stat) => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{String(stat.value)}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expired / suspended warning */}
      {(isExpired || sub?.status === 'suspended' || sub?.status === 'past_due') && (
        <div style={{
          background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10,
          padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#B71C1C' }}>
              {sub?.status === 'suspended' ? 'Account Suspended' : sub?.status === 'past_due' ? 'Payment Past Due' : 'Subscription Expired'}
            </div>
            <div style={{ fontSize: 13, color: '#C62828', marginTop: 2 }}>
              {sub?.status === 'suspended'
                ? 'Your account has been suspended. Please contact support to restore access.'
                : 'Please renew your subscription to continue using all features. Contact your account manager.'}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', background: '#B71C1C' }} onClick={() => setShowUpgrade(true)}>
            Renew Now
          </button>
        </div>
      )}

      {/* Trial warning */}
      {sub?.status === 'trial' && daysLeft !== null && daysLeft <= 7 && (
        <div style={{
          background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 10,
          padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 22 }}>🕐</span>
          <div>
            <div style={{ fontWeight: 700, color: '#E65100' }}>Trial ending in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 13, color: '#BF360C' }}>Upgrade now to keep full access to all features without interruption.</div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowUpgrade(true)}>
            Upgrade
          </button>
        </div>
      )}

      {/* Upgrade panel */}
      {showUpgrade && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">⬆️ Upgrade / Change Plan</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Select a plan and submit — our team will process the change</div>
          </div>
          <div className="card-body">
            {/* Billing cycle toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>Billing:</span>
              {(['monthly', 'yearly'] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setSelectedCycle(cycle)}
                  style={{
                    padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: selectedCycle === cycle ? 'var(--blue)' : 'var(--gray-100)',
                    color: selectedCycle === cycle ? 'white' : 'var(--gray-600)',
                  }}
                >
                  {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  {cycle === 'yearly' && <span style={{ marginLeft: 5, fontSize: 11, background: '#E8F5E9', color: '#2E7D32', borderRadius: 4, padding: '1px 5px' }}>Save 15%</span>}
                </button>
              ))}
            </div>

            {/* Plan cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              {plans.filter((p) => p.id !== 'trial').map((plan) => {
                const isCurrent = sub?.plan_id === plan.id
                const isSelected = selectedPlanId === plan.id
                const price = selectedCycle === 'yearly' ? plan.price_yearly : plan.price_monthly
                return (
                  <div
                    key={plan.id}
                    onClick={() => !isCurrent && setSelectedPlanId(plan.id)}
                    style={{
                      border: isSelected ? `2px solid ${PLAN_ACCENT[plan.id] ?? '#1565C0'}` : isCurrent ? `2px solid ${PLAN_ACCENT[plan.id] ?? '#1565C0'}` : '1px solid var(--gray-200)',
                      background: isSelected ? (PLAN_COLORS[plan.id] ?? '#F0F4F8') : isCurrent ? (PLAN_COLORS[plan.id] ?? '#F0F4F8') : 'white',
                      borderRadius: 12, padding: '20px 18px',
                      cursor: isCurrent ? 'default' : 'pointer',
                      transition: 'box-shadow 0.15s',
                      boxShadow: isSelected ? `0 0 0 3px ${PLAN_ACCENT[plan.id] ?? '#1565C0'}33` : undefined,
                    }}
                  >
                    {isCurrent && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: PLAN_ACCENT[plan.id], marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Current Plan</div>
                    )}
                    {isSelected && !isCurrent && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: PLAN_ACCENT[plan.id] ?? '#1565C0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>✓ Selected</div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{plan.name}</div>
                    {price > 0 ? (
                      <div style={{ fontSize: 20, fontWeight: 800, color: PLAN_ACCENT[plan.id] ?? '#1565C0', marginBottom: 8 }}>
                        SAR {price}<span style={{ fontSize: 12, color: '#6B8299', fontWeight: 400 }}>/{selectedCycle === 'yearly' ? 'yr' : 'mo'}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 700, color: PLAN_ACCENT[plan.id] ?? '#1565C0', marginBottom: 8 }}>Custom Pricing</div>
                    )}
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: '#3D5166' }}>
                      {plan.features.map((f, i) => (
                        <li key={i} style={{ paddingBottom: 3, display: 'flex', gap: 6 }}>
                          <span style={{ color: PLAN_ACCENT[plan.id] ?? '#1565C0' }}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            {/* Submit button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-primary"
                disabled={!selectedPlanId || selectedPlanId === sub?.plan_id || isPending}
                onClick={() => {
                  if (!selectedPlanId) return
                  startTransition(async () => {
                    const r = await requestPlanUpgrade(selectedPlanId, selectedCycle)
                    if (r.success) {
                      toast.success('Upgrade request submitted! Our team will be in touch shortly.')
                      setShowUpgrade(false)
                      setSelectedPlanId('')
                    } else {
                      toast.error(r.error ?? 'Failed to submit request')
                    }
                  })
                }}
              >
                {isPending ? '⏳ Submitting…' : '⬆️ Request Upgrade'}
              </button>
              {!selectedPlanId && (
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Select a plan above to continue</span>
              )}
              {selectedPlanId === sub?.plan_id && (
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>This is your current plan</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E8F5E9' }}>🧾</div>
          <div className="kpi-label">Total Invoices</div>
          <div className="kpi-value">{invoices.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>✅</div>
          <div className="kpi-label">Paid Invoices</div>
          <div className="kpi-value">{paidInvoices.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#F3E5F5' }}>💰</div>
          <div className="kpi-label">Total Spend</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>SAR {Math.round(totalSpend).toLocaleString()}</div>
        </div>
      </div>

      {/* Invoice history */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Invoice History</div>
          <div className="card-subtitle">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>VAT</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Paid Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{inv.invoice_number}</td>
                    <td className="text-sm text-muted">
                      {inv.period_start ? new Date(inv.period_start).toLocaleDateString('en-CA') : '—'}
                      {inv.period_end ? ` → ${new Date(inv.period_end).toLocaleDateString('en-CA')}` : ''}
                    </td>
                    <td>SAR {Number(inv.amount).toFixed(2)}</td>
                    <td className="text-muted text-sm">SAR {Number(inv.tax).toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>SAR {Number(inv.total).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[inv.status] ?? 'badge-gray'}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                    <td className="text-sm text-muted">
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-CA') : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toast.info('PDF download coming soon')}
                      >
                        📄 PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>
                      No invoices yet. Your invoices will appear here once generated.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Plan features comparison */}
      {currentPlan && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div className="card-title">Your Plan Features</div>
            <div className="card-subtitle">{currentPlan.name} plan</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { label: 'Max Staff', value: currentPlan.max_users >= 9999 ? 'Unlimited' : currentPlan.max_users },
                { label: 'Max Branches', value: currentPlan.max_branches >= 99 ? 'Unlimited' : currentPlan.max_branches },
                { label: 'Max Departments', value: currentPlan.max_departments >= 99 ? 'Unlimited' : currentPlan.max_departments },
              ].map((item) => (
                <div key={item.label} style={{ background: PLAN_COLORS[currentPlan.id] ?? '#F0F4F8', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: PLAN_ACCENT[currentPlan.id] }}>{String(item.value)}</div>
                  <div style={{ fontSize: 12, color: '#6B8299', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {currentPlan.features.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3D5166' }}>
                  <span style={{ color: PLAN_ACCENT[currentPlan.id], fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
