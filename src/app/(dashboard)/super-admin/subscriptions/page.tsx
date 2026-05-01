import Link from 'next/link'
import {
  getBillingDashboardData,
  getSubscriptions,
  getHospitalSignups,
  getCoupons,
  getInvoices,
  getPlans,
  getAllPlans,
} from '@/actions/billing'
import SubscriptionsClient from './SubscriptionsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Subscriptions — CAMS' }

export default async function SubscriptionsPage() {
  const [dashData, subscriptions, signups, coupons, invoices, plans, allPlans] = await Promise.all([
    getBillingDashboardData(),
    getSubscriptions(),
    getHospitalSignups(),
    getCoupons(),
    getInvoices(),
    getPlans(),
    getAllPlans(),
  ])

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Billing & Subscriptions</h1>
          <p>Manage hospital plans, invoices, and coupons</p>
        </div>
        <div className="page-header-actions">
          <Link href="/super-admin" className="btn btn-secondary btn-sm">← Overview</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20 }}>
        {[
          { icon: '💳', label: 'Paying Hospitals', value: dashData.totalPaying, bg: '#E8F5E9' },
          { icon: '🆓', label: 'Active Trials', value: dashData.activeTrials, bg: '#E3F2FD' },
          { icon: '⏰', label: 'Expired Plans', value: dashData.expiredPlans, bg: '#FFEBEE', alert: dashData.expiredPlans > 0 },
          { icon: '⏸️', label: 'Suspended', value: dashData.suspended, bg: '#FFF8E1', alert: dashData.suspended > 0 },
          { icon: '💰', label: 'Total Revenue', value: `SAR ${Math.round(dashData.totalRevenue).toLocaleString()}`, bg: '#F3E5F5' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: typeof k.value === 'string' && k.value.length > 8 ? 16 : undefined }}>{k.value}</div>
            {k.alert && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      <SubscriptionsClient
        dashData={dashData}
        subscriptions={subscriptions}
        signups={signups}
        coupons={coupons}
        invoices={invoices}
        plans={plans}
        allPlans={allPlans}
      />
    </>
  )
}
