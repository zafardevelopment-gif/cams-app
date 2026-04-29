'use client'

import Link from 'next/link'

interface Props {
  status: string
  planId: string
  periodEnd?: string | null
  role: string
}

export default function SubscriptionBanner({ status, planId, periodEnd, role }: Props) {
  const isSuperAdmin = role === 'super_admin'
  if (isSuperAdmin) return null

  const daysLeft = periodEnd
    ? Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86400000)
    : null

  const isExpired = periodEnd && new Date(periodEnd) < new Date()

  // Fully suspended — hard block banner
  if (status === 'suspended') {
    return (
      <div style={{
        background: '#B71C1C', color: 'white',
        padding: '10px 20px', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 300,
      }}>
        ⛔ Your account is suspended. All actions are disabled. Contact support to restore access.
        <Link href="/billing" style={{ color: 'white', textDecoration: 'underline' }}>View Billing</Link>
      </div>
    )
  }

  // Read-only mode
  if (status === 'read_only') {
    return (
      <div style={{
        background: '#6A1B9A', color: 'white',
        padding: '10px 20px', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 300,
      }}>
        📖 Account is in read-only mode. Upgrade your plan to resume operations.
        <Link href="/billing" style={{ color: 'white', textDecoration: 'underline' }}>Upgrade</Link>
      </div>
    )
  }

  // Past due
  if (status === 'past_due') {
    return (
      <div style={{
        background: '#E65100', color: 'white',
        padding: '10px 20px', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 300,
      }}>
        💳 Payment past due. Please update your payment to avoid service interruption.
        <Link href="/billing" style={{ color: 'white', textDecoration: 'underline' }}>View Invoices</Link>
      </div>
    )
  }

  // Expired
  if (isExpired && status !== 'trial') {
    return (
      <div style={{
        background: '#C62828', color: 'white',
        padding: '10px 20px', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 300,
      }}>
        ⏰ Your {planId} subscription has expired. Renew to restore full access.
        <Link href="/billing" style={{ color: 'white', textDecoration: 'underline' }}>Renew Now</Link>
      </div>
    )
  }

  // Trial expiring soon (≤ 7 days)
  if (status === 'trial' && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0) {
    return (
      <div style={{
        background: '#F57F17', color: 'white',
        padding: '8px 20px', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 300,
      }}>
        🕐 Trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>. Upgrade to keep full access.
        <Link href="/billing" style={{ color: 'white', textDecoration: 'underline' }}>Upgrade Now</Link>
      </div>
    )
  }

  return null
}
