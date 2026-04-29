import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import HospitalsClient from './HospitalsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Manage Hospitals — CAMS' }

export default async function ManageHospitalsPage() {
  const admin = createAdminClient()

  const [{ data: hospitals }, { data: subscriptions }] = await Promise.all([
    admin
      .from(T.hospitals)
      .select('id, name, contact_email, region, city, subscription_plan, cbahi_accredited, is_active, created_at, max_users')
      .order('created_at'),
    admin
      .from(T.subscriptions)
      .select(`id, hospital_id, plan_id, status, current_period_end, billing_cycle, plan:${J.plans}!plan_id(name, price_monthly)`),
  ])

  const list = hospitals ?? []
  const subMap = Object.fromEntries((subscriptions ?? []).map((s) => [s.hospital_id, s]))

  const active   = list.filter((h) => h.is_active).length
  const inactive = list.filter((h) => !h.is_active).length
  const subList  = Object.values(subMap) as Array<{ status: string }>
  const trials   = subList.filter((s) => s.status === 'trial').length
  const paying   = subList.filter((s) => s.status === 'active').length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Manage Hospitals</h1>
          <p>{list.length} total hospital accounts</p>
        </div>
        <div className="page-header-actions">
          <Link href="/super-admin" className="btn btn-secondary btn-sm">← Overview</Link>
          <Link href="/super-admin/subscriptions" className="btn btn-secondary btn-sm">💳 Subscriptions</Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { icon: '✅', label: 'Active', value: active, bg: '#E8F5E9' },
          { icon: '⏸️', label: 'Inactive', value: inactive, bg: '#FFEBEE' },
          { icon: '🆓', label: 'On Trial', value: trials, bg: '#E3F2FD' },
          { icon: '💳', label: 'Paying', value: paying, bg: '#F3E5F5' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <HospitalsClient hospitals={list} subMap={subMap} />
    </>
  )
}
