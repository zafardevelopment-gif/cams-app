'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { updateSubscription } from '@/actions/billing'

interface Hospital {
  id: string
  name: string
  contact_email: string | null
  region: string | null
  city: string | null
  subscription_plan: string
  cbahi_accredited: boolean
  is_active: boolean
  created_at: string
  max_users: number
}

interface SubInfo {
  id: string
  plan_id: string
  status: string
  current_period_end: string | null
  billing_cycle: string
  plan?: { name: string; price_monthly: number } | Array<{ name: string; price_monthly: number }> | null
}

const STATUS_BADGE: Record<string, string> = {
  trial: 'badge-blue', active: 'badge-green', past_due: 'badge-yellow',
  suspended: 'badge-red', cancelled: 'badge-gray', read_only: 'badge-purple',
}

export default function HospitalsClient({
  hospitals,
  subMap,
}: {
  hospitals: Hospital[]
  subMap: Record<string, SubInfo>
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [isPending, startTransition] = useTransition()
  const [suspendId, setSuspendId] = useState<string | null>(null)
  const [activateId, setActivateId] = useState<string | null>(null)

  const filtered = hospitals.filter((h) => {
    const sub = subMap[h.id]
    const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) || h.contact_email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || (filterStatus === 'active' ? h.is_active : !h.is_active)
    const matchPlan = !filterPlan || sub?.plan_id === filterPlan
    return matchSearch && matchStatus && matchPlan
  })

  function action(fn: () => Promise<void>) {
    startTransition(async () => { await fn() })
  }

  async function toggleSuspend(hospitalId: string, suspend: boolean) {
    const sub = subMap[hospitalId]
    if (!sub) { toast.error('No subscription found for this hospital'); return }
    const fd = new FormData()
    fd.set('status', suspend ? 'suspended' : 'active')
    const r = await updateSubscription(sub.id, fd)
    if (r.success) toast.success(suspend ? 'Hospital suspended' : 'Hospital activated')
    else toast.error(r.error ?? 'Failed')
    setSuspendId(null)
    setActivateId(null)
  }

  return (
    <>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              placeholder="Hospital name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label className="form-label">Plan</label>
            <select className="form-input" value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
              <option value="">All Plans</option>
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          {(search || filterStatus || filterPlan) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterPlan('') }}
            >
              Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)', alignSelf: 'center' }}>
            {filtered.length} of {hospitals.length} hospitals
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Region / City</th>
                  <th>Plan</th>
                  <th>Subscription</th>
                  <th>Period End</th>
                  <th>CBAHI</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => {
                  const sub = subMap[h.id]
                  const isExpired = sub?.current_period_end && new Date(sub.current_period_end) < new Date()
                  const planRaw = sub?.plan
                  const plan = planRaw ? (Array.isArray(planRaw) ? planRaw[0] : planRaw) : null
                  return (
                    <tr key={h.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg,var(--blue),var(--teal))' }}>🏥</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{h.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{h.contact_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{[h.region, h.city].filter(Boolean).join(' · ') || '—'}</td>
                      <td>
                        <span className="badge badge-blue">{sub?.plan_id ?? h.subscription_plan}</span>
                        {plan && plan.price_monthly > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>SAR {plan.price_monthly}/mo</div>
                        )}
                      </td>
                      <td>
                        {sub ? (
                          <span className={`badge ${STATUS_BADGE[sub.status] ?? 'badge-gray'}`}>{sub.status}</span>
                        ) : (
                          <span className="badge badge-gray">No sub</span>
                        )}
                      </td>
                      <td className={`text-sm ${isExpired ? '' : 'text-muted'}`} style={{ color: isExpired ? 'var(--red)' : undefined }}>
                        {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-CA') : '—'}
                        {isExpired && ' ⚠️'}
                      </td>
                      <td>{h.cbahi_accredited ? '✅' : '—'}</td>
                      <td>
                        <span className={`badge ${h.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {h.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <Link href="/super-admin/subscriptions" className="btn btn-secondary btn-sm">💳</Link>
                          {sub && (
                            h.is_active && sub.status !== 'suspended'
                              ? (
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={isPending}
                                  onClick={() => setSuspendId(h.id)}
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  className="btn btn-primary btn-sm"
                                  disabled={isPending}
                                  onClick={() => setActivateId(h.id)}
                                >
                                  Activate
                                </button>
                              )
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>
                      {hospitals.length === 0 ? 'No hospitals yet' : 'No results match your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Suspend confirm modal */}
      {suspendId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 400 }}>
            <h3 style={{ marginBottom: 10, color: 'var(--red)' }}>Suspend Hospital?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 20 }}>
              <strong>{hospitals.find((h) => h.id === suspendId)?.name}</strong> will be suspended.
              All staff will see a suspension notice and cannot perform actions.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-danger"
                disabled={isPending}
                onClick={() => action(() => toggleSuspend(suspendId, true))}
              >
                {isPending ? 'Suspending…' : 'Confirm Suspend'}
              </button>
              <button className="btn btn-secondary" onClick={() => setSuspendId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Activate confirm modal */}
      {activateId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 400 }}>
            <h3 style={{ marginBottom: 10, color: 'var(--green)' }}>Activate Hospital?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 20 }}>
              <strong>{hospitals.find((h) => h.id === activateId)?.name}</strong> will be reactivated with their current plan.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                disabled={isPending}
                onClick={() => action(() => toggleSuspend(activateId, false))}
              >
                {isPending ? 'Activating…' : 'Confirm Activate'}
              </button>
              <button className="btn btn-secondary" onClick={() => setActivateId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
