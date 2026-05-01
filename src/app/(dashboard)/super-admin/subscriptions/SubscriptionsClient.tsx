'use client'

import React, { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  approveHospitalSignup,
  rejectHospitalSignup,
  updateSubscription,
  createCoupon,
  toggleCoupon,
  createInvoice,
  markInvoicePaid,
  createPlan,
  updatePlan,
  deletePlan,
} from '@/actions/billing'
import { MonthlyLine } from '@/components/charts/Charts'

type DashData = Awaited<ReturnType<typeof import('@/actions/billing').getBillingDashboardData>>
type Subscription = Awaited<ReturnType<typeof import('@/actions/billing').getSubscriptions>>[number]
type Signup = Awaited<ReturnType<typeof import('@/actions/billing').getHospitalSignups>>[number]
type Coupon = Awaited<ReturnType<typeof import('@/actions/billing').getCoupons>>[number]
type Invoice = Awaited<ReturnType<typeof import('@/actions/billing').getInvoices>>[number]
type Plan = Awaited<ReturnType<typeof import('@/actions/billing').getPlans>>[number]
type AllPlan = Awaited<ReturnType<typeof import('@/actions/billing').getAllPlans>>[number]

const STATUS_BADGE: Record<string, string> = {
  trial: 'badge-blue', active: 'badge-green', past_due: 'badge-yellow',
  suspended: 'badge-red', cancelled: 'badge-gray', read_only: 'badge-purple',
  pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red',
  paid: 'badge-green', void: 'badge-gray', refunded: 'badge-blue',
}

export default function SubscriptionsClient({
  dashData, subscriptions, signups, coupons, invoices, plans, allPlans,
}: {
  dashData: DashData
  subscriptions: Subscription[]
  signups: Signup[]
  coupons: Coupon[]
  invoices: Invoice[]
  plans: Plan[]
  allPlans: AllPlan[]
}) {
  const [tab, setTab] = useState<'overview' | 'subscriptions' | 'signups' | 'invoices' | 'coupons' | 'plans'>('overview')
  const [isPending, startTransition] = useTransition()
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [payRefMap, setPayRefMap] = useState<Record<string, string>>({})
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planEditData, setPlanEditData] = useState<Partial<AllPlan>>({})
  const [deleteConfirmPlanId, setDeleteConfirmPlanId] = useState<string | null>(null)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'subscriptions', label: `Subscriptions (${subscriptions.length})`, icon: '💳' },
    { id: 'signups', label: `Signups (${signups.filter((s) => s.status === 'pending').length} pending)`, icon: '📝' },
    { id: 'invoices', label: `Invoices (${invoices.length})`, icon: '🧾' },
    { id: 'coupons', label: `Coupons (${coupons.length})`, icon: '🎟️' },
    { id: 'plans', label: `Plans (${allPlans.length})`, icon: '📦' },
  ] as const

  function action(fn: () => Promise<void>) {
    startTransition(async () => { await fn() })
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  const overviewTab = (
    <div>
      {/* Revenue chart */}
      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Monthly Revenue (SAR)</div></div>
          <div className="card-body">
            <MonthlyLine
              data={dashData.monthlyRevenue.map((r) => ({ month: r.month, count: r.revenue }))}
              color="#2E7D32"
              label="Revenue SAR"
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Plan Distribution</div></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(dashData.planBreakdown).map(([planId, count]) => {
                const total = subscriptions.length || 1
                const pct = Math.round((count / total) * 100)
                const colors: Record<string, string> = { trial: '#1565C0', basic: '#2E7D32', pro: '#6A1B9A', enterprise: '#F57F17' }
                return (
                  <div key={planId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{planId}</span>
                      <span style={{ color: 'var(--gray-500)' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ background: '#eee', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${pct}%`, background: colors[planId] ?? '#999', height: '100%', borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pending signups alert */}
      {dashData.pendingSignups > 0 && (
        <div style={{ background: '#FFF3E0', border: '1px solid #FFB300', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>📝</span>
          <div>
            <div style={{ fontWeight: 600, color: '#E65100' }}>{dashData.pendingSignups} pending hospital signup{dashData.pendingSignups > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12, color: '#BF360C' }}>Review and approve new hospital accounts</div>
          </div>
          <button onClick={() => setTab('signups')} className="btn btn-sm" style={{ marginLeft: 'auto', background: '#E65100', color: 'white', border: 'none' }}>Review</button>
        </div>
      )}

      {/* Recent signups table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Signup Requests</div>
          <button onClick={() => setTab('signups')} className="btn btn-secondary btn-sm">View All</button>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Hospital</th><th>Plan</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {dashData.recentSignups.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.hospital_name}</td>
                    <td><span className="badge badge-blue">{s.plan_id}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-gray'}`}>{s.status}</span></td>
                    <td className="text-sm text-muted">{new Date(s.created_at).toLocaleDateString('en-CA')}</td>
                  </tr>
                ))}
                {dashData.recentSignups.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No signups yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Subscriptions ─────────────────────────────────────────────────────────

  const subsTab = (
    <div className="card">
      <div className="card-header">
        <div className="card-title">All Subscriptions</div>
      </div>
      <div className="card-body p-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Hospital</th><th>Plan</th><th>Status</th><th>Period End</th><th>Billing</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => {
                const hospitalRaw = sub.hospital as unknown
                const hospital = Array.isArray(hospitalRaw) ? hospitalRaw[0] : hospitalRaw as { id: string; name: string } | null
                const planRaw = sub.plan as unknown
                const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw as { name: string; price_monthly: number } | null
                const isExpired = sub.current_period_end && new Date(sub.current_period_end) < new Date()

                return (
                  <tr key={sub.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{hospital?.name ?? '—'}</div>
                    </td>
                    <td><span className="badge badge-blue">{sub.plan_id}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[sub.status] ?? 'badge-gray'}`}>{sub.status}</span></td>
                    <td className={`text-sm ${isExpired ? 'text-red' : 'text-muted'}`}>
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-CA') : '—'}
                      {isExpired && ' ⚠️'}
                    </td>
                    <td className="text-sm">{sub.billing_cycle}</td>
                    <td>
                      {editingSubId === sub.id ? (
                        <form action={async (fd) => {
                          action(async () => {
                            const r = await updateSubscription(sub.id, fd)
                            if (r.success) { toast.success('Updated'); setEditingSubId(null) }
                            else toast.error(r.error ?? 'Failed')
                          })
                        }} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minWidth: 280 }}>
                          <select name="plan_id" defaultValue={sub.plan_id} className="form-input" style={{ fontSize: 12, padding: '4px 6px' }}>
                            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select name="status" defaultValue={sub.status} className="form-input" style={{ fontSize: 12, padding: '4px 6px' }}>
                            {['trial','active','past_due','suspended','cancelled','read_only'].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input type="date" name="period_end" defaultValue={sub.current_period_end?.slice(0,10) ?? ''} className="form-input" style={{ fontSize: 12, padding: '4px 6px' }} />
                          <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>Save</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingSubId(null)}>✕</button>
                        </form>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingSubId(sub.id)}>Edit</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {subscriptions.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No subscriptions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ── Signups ───────────────────────────────────────────────────────────────

  const signupsTab = (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Hospital Signup Requests</div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{signups.filter((s) => s.status === 'pending').length} pending</div>
      </div>
      <div className="card-body p-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Hospital</th><th>Contact</th><th>Plan</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {signups.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.hospital_name}</div>
                    <div className="text-xs text-muted">{s.city}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{s.contact_name}</div>
                    <div className="text-xs text-muted">{s.contact_email}</div>
                  </td>
                  <td><span className="badge badge-blue">{s.plan_id}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-gray'}`}>{s.status}</span></td>
                  <td className="text-sm text-muted">{new Date(s.created_at).toLocaleDateString('en-CA')}</td>
                  <td>
                    {s.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={isPending}
                          onClick={() => action(async () => {
                            const r = await approveHospitalSignup(s.id)
                            r.success ? toast.success('Hospital account created!') : toast.error(r.error ?? 'Failed')
                          })}
                        >
                          ✅ Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => { setRejectId(s.id); setRejectReason('') }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">{s.status}</span>
                    )}
                  </td>
                </tr>
              ))}
              {signups.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No signups yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 420 }}>
            <h3 style={{ marginBottom: 14 }}>Reject Signup</h3>
            <textarea
              className="form-input"
              placeholder="Reason for rejection (shown to applicant)"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ resize: 'vertical', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-danger"
                disabled={isPending || !rejectReason.trim()}
                onClick={() => action(async () => {
                  const r = await rejectHospitalSignup(rejectId, rejectReason)
                  if (r.success) { toast.success('Signup rejected'); setRejectId(null) }
                  else toast.error(r.error ?? 'Failed')
                })}
              >
                Confirm Reject
              </button>
              <button className="btn btn-secondary" onClick={() => setRejectId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Invoices ──────────────────────────────────────────────────────────────

  const invoicesTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowInvoiceForm(!showInvoiceForm)}>
          {showInvoiceForm ? '✕ Cancel' : '＋ New Invoice'}
        </button>
      </div>

      {showInvoiceForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Create Invoice</div></div>
          <div className="card-body">
            <form action={async (fd) => {
              action(async () => {
                const r = await createInvoice(fd)
                if (r.success) { toast.success(`Invoice ${r.data?.invoice_number} created`); setShowInvoiceForm(false) }
                else toast.error(r.error ?? 'Failed')
              })
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label">Hospital *</label>
                  <select name="hospital_id" required className="form-input">
                    <option value="">Select hospital</option>
                    {subscriptions.map((s) => {
                      const h = Array.isArray(s.hospital) ? s.hospital[0] : s.hospital as { id: string; name: string } | null
                      return h ? <option key={h.id} value={h.id}>{h.name}</option> : null
                    })}
                  </select>
                </div>
                <div>
                  <label className="form-label">Plan</label>
                  <select name="plan_id" className="form-input">
                    <option value="">Select plan</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount (SAR) *</label>
                  <input name="amount" type="number" min="0" step="0.01" required className="form-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="form-label">VAT (SAR)</label>
                  <input name="tax" type="number" min="0" step="0.01" className="form-input" placeholder="0.00" defaultValue="0" />
                </div>
                <div>
                  <label className="form-label">Payment Method</label>
                  <select name="payment_method" className="form-input">
                    <option value="">Select</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Credit Card</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Period Start</label>
                  <input name="period_start" type="date" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Period End</label>
                  <input name="period_end" type="date" className="form-input" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <input name="notes" className="form-input" placeholder="Optional notes" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={isPending}>
                Create Invoice
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Invoice #</th><th>Hospital</th><th>Amount</th><th>VAT</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const hospitalRaw = inv.hospital as unknown
                  const hospital = Array.isArray(hospitalRaw) ? hospitalRaw[0] : hospitalRaw as { name: string } | null
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{inv.invoice_number}</td>
                      <td>{hospital?.name ?? '—'}</td>
                      <td>SAR {Number(inv.amount).toFixed(2)}</td>
                      <td className="text-muted text-sm">SAR {Number(inv.tax).toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>SAR {Number(inv.total).toFixed(2)}</td>
                      <td><span className={`badge ${STATUS_BADGE[inv.status] ?? 'badge-gray'}`}>{inv.status}</span></td>
                      <td className="text-sm text-muted">{new Date(inv.created_at).toLocaleDateString('en-CA')}</td>
                      <td>
                        {inv.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              type="text"
                              placeholder="Ref #"
                              value={payRefMap[inv.id] ?? ''}
                              onChange={(e) => setPayRefMap((m) => ({ ...m, [inv.id]: e.target.value }))}
                              style={{ width: 80, padding: '3px 6px', fontSize: 11, border: '1px solid var(--gray-200)', borderRadius: 6 }}
                            />
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={isPending}
                              onClick={() => action(async () => {
                                const r = await markInvoicePaid(inv.id, payRefMap[inv.id])
                                r.success ? toast.success('Marked as paid') : toast.error(r.error ?? 'Failed')
                              })}
                            >
                              Mark Paid
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {invoices.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No invoices yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Coupons ───────────────────────────────────────────────────────────────

  const couponsTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCouponForm(!showCouponForm)}>
          {showCouponForm ? '✕ Cancel' : '＋ New Coupon'}
        </button>
      </div>

      {showCouponForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Create Coupon</div></div>
          <div className="card-body">
            <form action={async (fd) => {
              action(async () => {
                const r = await createCoupon(fd)
                if (r.success) { toast.success('Coupon created'); setShowCouponForm(false) }
                else toast.error(r.error ?? 'Failed')
              })
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label">Code *</label>
                  <input name="code" required className="form-input" placeholder="e.g. LAUNCH50" style={{ textTransform: 'uppercase' }} />
                </div>
                <div>
                  <label className="form-label">Discount Type</label>
                  <select name="discount_type" className="form-input">
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed (SAR)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Discount Value *</label>
                  <input name="discount_value" type="number" required min="1" className="form-input" placeholder="e.g. 20" />
                </div>
                <div>
                  <label className="form-label">Applies to Plan</label>
                  <select name="applies_to_plan" className="form-input">
                    <option value="">All Plans</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Max Uses</label>
                  <input name="max_uses" type="number" min="1" className="form-input" placeholder="Unlimited if blank" />
                </div>
                <div>
                  <label className="form-label">Valid Until</label>
                  <input name="valid_until" type="date" className="form-input" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Description</label>
                  <input name="description" className="form-input" placeholder="Internal description" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={isPending}>
                Create Coupon
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Type</th><th>Value</th><th>Plan</th><th>Uses</th><th>Valid Until</th><th>Status</th><th>Toggle</th></tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{c.code}</td>
                    <td><span className="badge badge-blue">{c.discount_type}</span></td>
                    <td style={{ fontWeight: 600 }}>
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : `SAR ${c.discount_value}`}
                    </td>
                    <td>{c.applies_to_plan ?? <span className="text-muted">All</span>}</td>
                    <td className="text-sm">
                      {c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}
                    </td>
                    <td className="text-sm text-muted">{c.valid_until ? new Date(c.valid_until).toLocaleDateString('en-CA') : '∞'}</td>
                    <td><span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button
                        className={`btn btn-sm ${c.is_active ? 'btn-danger' : 'btn-primary'}`}
                        disabled={isPending}
                        onClick={() => action(async () => {
                          const r = await toggleCoupon(c.id, !c.is_active)
                          r.success ? toast.success('Updated') : toast.error(r.error ?? 'Failed')
                        })}
                      >
                        {c.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No coupons yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Plans ─────────────────────────────────────────────────────────────────

  const plansTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowPlanForm(!showPlanForm); setEditingPlanId(null) }}>
          {showPlanForm ? '✕ Cancel' : '＋ New Plan'}
        </button>
      </div>

      {showPlanForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Create Plan</div></div>
          <div className="card-body">
            <form action={async (fd) => {
              action(async () => {
                const r = await createPlan(fd)
                if (r.success) { toast.success('Plan created'); setShowPlanForm(false) }
                else toast.error(r.error ?? 'Failed')
              })
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label">Plan ID (slug) *</label>
                  <input name="id" required className="form-input" placeholder="e.g. premium" pattern="[a-z0-9_-]+" />
                </div>
                <div>
                  <label className="form-label">Name *</label>
                  <input name="name" required className="form-input" placeholder="e.g. Premium" />
                </div>
                <div>
                  <label className="form-label">Name (Arabic)</label>
                  <input name="name_ar" className="form-input" placeholder="بريميوم" dir="rtl" />
                </div>
                <div>
                  <label className="form-label">Monthly Price (SAR) *</label>
                  <input name="price_monthly" type="number" required min="0" step="0.01" className="form-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="form-label">Yearly Price (SAR) *</label>
                  <input name="price_yearly" type="number" required min="0" step="0.01" className="form-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="form-label">Max Users *</label>
                  <input name="max_users" type="number" required min="1" className="form-input" placeholder="100" />
                </div>
                <div>
                  <label className="form-label">Max Branches *</label>
                  <input name="max_branches" type="number" required min="1" className="form-input" placeholder="5" />
                </div>
                <div>
                  <label className="form-label">Max Departments *</label>
                  <input name="max_departments" type="number" required min="1" className="form-input" placeholder="20" />
                </div>
                <div>
                  <label className="form-label">Duration (days) *</label>
                  <input name="duration_days" type="number" required min="1" className="form-input" defaultValue="30" />
                </div>
                <div>
                  <label className="form-label">Trial Days</label>
                  <input name="trial_days" type="number" min="0" className="form-input" defaultValue="0" />
                </div>
                <div>
                  <label className="form-label">Sort Order</label>
                  <input name="sort_order" type="number" min="0" className="form-input" defaultValue="10" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Description</label>
                  <input name="description" className="form-input" placeholder="Short plan description" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Features (one per line)</label>
                  <textarea name="features" rows={4} className="form-input" placeholder="Up to 100 staff&#10;Multi-branch support&#10;Priority support" style={{ resize: 'vertical' }} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={isPending}>
                Create Plan
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Name</th><th>Monthly</th><th>Yearly</th><th>Max Users</th><th>Duration</th><th>Trial</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {allPlans.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-500)' }}>{p.id}</td>
                      <td style={{ fontWeight: 600 }}>
                        {p.name}
                        {p.name_ar && <div className="text-xs text-muted" dir="rtl">{p.name_ar}</div>}
                      </td>
                      <td>SAR {Number(p.price_monthly).toFixed(2)}</td>
                      <td>SAR {Number(p.price_yearly).toFixed(2)}</td>
                      <td>{p.max_users.toLocaleString()}</td>
                      <td className="text-sm">{p.duration_days ?? 30}d</td>
                      <td className="text-sm">{p.trial_days ?? 0}d</td>
                      <td>
                        <span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              if (editingPlanId === p.id) { setEditingPlanId(null) }
                              else { setEditingPlanId(p.id); setPlanEditData(p); setShowPlanForm(false) }
                            }}
                          >
                            {editingPlanId === p.id ? '✕' : 'Edit'}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: p.is_active ? '#FFEBEE' : '#E8F5E9', color: p.is_active ? '#C62828' : '#2E7D32', border: 'none' }}
                            disabled={isPending}
                            onClick={() => action(async () => {
                              const fd = new FormData()
                              fd.set('is_active', String(!p.is_active))
                              const r = await updatePlan(p.id, fd)
                              r.success ? toast.success(`Plan ${p.is_active ? 'deactivated' : 'activated'}`) : toast.error(r.error ?? 'Failed')
                            })}
                          >
                            {p.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteConfirmPlanId(p.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingPlanId === p.id && (
                      <tr key={`${p.id}-edit`}>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div style={{ background: '#F8FAFF', borderTop: '2px solid var(--blue)', padding: 16 }}>
                            <form action={async (fd) => {
                              action(async () => {
                                const r = await updatePlan(p.id, fd)
                                if (r.success) { toast.success('Plan updated'); setEditingPlanId(null) }
                                else toast.error(r.error ?? 'Failed')
                              })
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                                <div>
                                  <label className="form-label">Name</label>
                                  <input name="name" className="form-input" defaultValue={planEditData.name ?? p.name} />
                                </div>
                                <div>
                                  <label className="form-label">Name (Arabic)</label>
                                  <input name="name_ar" className="form-input" defaultValue={planEditData.name_ar ?? p.name_ar ?? ''} dir="rtl" />
                                </div>
                                <div>
                                  <label className="form-label">Monthly Price</label>
                                  <input name="price_monthly" type="number" min="0" step="0.01" className="form-input" defaultValue={Number(p.price_monthly)} />
                                </div>
                                <div>
                                  <label className="form-label">Yearly Price</label>
                                  <input name="price_yearly" type="number" min="0" step="0.01" className="form-input" defaultValue={Number(p.price_yearly)} />
                                </div>
                                <div>
                                  <label className="form-label">Max Users</label>
                                  <input name="max_users" type="number" min="1" className="form-input" defaultValue={p.max_users} />
                                </div>
                                <div>
                                  <label className="form-label">Max Branches</label>
                                  <input name="max_branches" type="number" min="1" className="form-input" defaultValue={p.max_branches} />
                                </div>
                                <div>
                                  <label className="form-label">Max Departments</label>
                                  <input name="max_departments" type="number" min="1" className="form-input" defaultValue={p.max_departments} />
                                </div>
                                <div>
                                  <label className="form-label">Duration (days)</label>
                                  <input name="duration_days" type="number" min="1" className="form-input" defaultValue={p.duration_days ?? 30} />
                                </div>
                                <div>
                                  <label className="form-label">Trial Days</label>
                                  <input name="trial_days" type="number" min="0" className="form-input" defaultValue={p.trial_days ?? 0} />
                                </div>
                                <div>
                                  <label className="form-label">Sort Order</label>
                                  <input name="sort_order" type="number" min="0" className="form-input" defaultValue={p.sort_order} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                  <label className="form-label">Description</label>
                                  <input name="description" className="form-input" defaultValue={p.description ?? ''} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                  <label className="form-label">Features (one per line)</label>
                                  <textarea
                                    name="features"
                                    rows={4}
                                    className="form-input"
                                    defaultValue={Array.isArray(p.features) ? (p.features as string[]).join('\n') : ''}
                                    style={{ resize: 'vertical' }}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>Save Changes</button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingPlanId(null)}>Cancel</button>
                              </div>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {allPlans.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No plans yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirmPlanId && (() => {
        const plan = allPlans.find((p) => p.id === deleteConfirmPlanId)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 400 }}>
              <h3 style={{ marginBottom: 10, color: '#C62828' }}>Delete Plan?</h3>
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 20 }}>
                Are you sure you want to delete <strong>{plan?.name}</strong>? This cannot be undone.
                Hospitals with active subscriptions on this plan will block deletion.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-danger"
                  disabled={isPending}
                  onClick={() => action(async () => {
                    const r = await deletePlan(deleteConfirmPlanId)
                    if (r.success) { toast.success('Plan deleted'); setDeleteConfirmPlanId(null) }
                    else toast.error(r.error ?? 'Cannot delete plan')
                  })}
                >
                  Delete
                </button>
                <button className="btn btn-secondary" onClick={() => setDeleteConfirmPlanId(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )

  const tabContent: Record<string, React.ReactNode> = {
    overview: overviewTab,
    subscriptions: subsTab,
    signups: signupsTab,
    invoices: invoicesTab,
    coupons: couponsTab,
    plans: plansTab,
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--gray-200)', marginBottom: 20, overflowX: 'auto', paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--blue)' : 'var(--gray-500)',
              borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tabContent[tab]}
    </div>
  )
}
