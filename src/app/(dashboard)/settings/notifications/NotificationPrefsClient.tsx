'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { saveNotificationPrefs } from '@/actions/notifications'

type PrefKey = string
type Prefs = Record<PrefKey, boolean>

const CATEGORIES = [
  { key: 'assessments',  icon: '✅', label: 'Assessments',  desc: 'Assessment assigned, submitted, result notifications' },
  { key: 'approvals',   icon: '✍️', label: 'Approvals',    desc: 'Pending approval requests and decisions' },
  { key: 'transfers',   icon: '🔄', label: 'Transfers',    desc: 'Transfer requests and status updates' },
  { key: 'certificates',icon: '🏅', label: 'Certificates', desc: 'Certificate issued, expiry, renewal reminders' },
  { key: 'billing',     icon: '💳', label: 'Billing',      desc: 'Subscription expiry, payment reminders' },
  { key: 'system',      icon: '🔧', label: 'System',       desc: 'System alerts, maintenance notices' },
]

function getPref(prefs: Prefs, key: string, fallback = true): boolean {
  return key in prefs ? Boolean(prefs[key]) : fallback
}

export default function NotificationPrefsClient({ prefs: initialPrefs }: { prefs: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs)
  const [isPending, startTransition] = useTransition()

  function toggle(key: string) {
    setPrefs((prev) => ({ ...prev, [key]: !getPref(prev, key) }))
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData()
      const cats = CATEGORIES.map((c) => c.key)
      for (const ch of ['inapp', 'email']) {
        for (const cat of cats) {
          const key = `${ch}_${cat}`
          if (getPref(prefs, key)) fd.set(key, 'on')
        }
      }
      const r = await saveNotificationPrefs(fd)
      if (r.success) toast.success('Preferences saved')
      else toast.error(r.error ?? 'Failed to save')
    })
  }

  function setAll(enabled: boolean) {
    const next: Prefs = {}
    for (const { key } of CATEGORIES) {
      next[`inapp_${key}`] = enabled
      next[`email_${key}`] = enabled
    }
    setPrefs(next)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Notification Preferences</h1>
          <p>Choose which notifications you receive and how</p>
        </div>
        <div className="page-header-actions">
          <Link href="/settings" className="btn btn-secondary btn-sm">← Settings</Link>
          <Link href="/notifications" className="btn btn-secondary btn-sm">🔔 View Notifications</Link>
        </div>
      </div>

      {/* Quick toggles */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>Quick set:</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setAll(true)}>Enable All</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setAll(false)}>Disable All</button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const next: Prefs = {}
              for (const { key } of CATEGORIES) {
                next[`inapp_${key}`] = true
                next[`email_${key}`] = false
              }
              setPrefs(next)
            }}
          >
            In-app Only
          </button>
        </div>
      </div>

      <div className="card">
        {/* Header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 100px 100px',
          padding: '10px 20px', borderBottom: '2px solid var(--gray-100)',
          fontSize: 11, fontWeight: 700, color: 'var(--gray-500)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <div>Notification Type</div>
          <div style={{ textAlign: 'center' }}>In-App 🔔</div>
          <div style={{ textAlign: 'center' }}>Email 📧</div>
        </div>

        {CATEGORIES.map((cat, i) => (
          <div
            key={cat.key}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 100px',
              padding: '16px 20px',
              borderBottom: i < CATEGORIES.length - 1 ? '1px solid var(--gray-100)' : 'none',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 16 }}>{cat.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{cat.label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', paddingLeft: 24 }}>{cat.desc}</div>
            </div>

            {/* In-app toggle */}
            <div style={{ textAlign: 'center' }}>
              <Toggle
                enabled={getPref(prefs, `inapp_${cat.key}`)}
                onToggle={() => toggle(`inapp_${cat.key}`)}
              />
            </div>

            {/* Email toggle */}
            <div style={{ textAlign: 'center' }}>
              <Toggle
                enabled={getPref(prefs, `email_${cat.key}`, cat.key !== 'system')}
                onToggle={() => toggle(`email_${cat.key}`)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div style={{
        background: '#E3F2FD', border: '1px solid #BBDEFB', borderRadius: 10,
        padding: '12px 18px', marginTop: 14, fontSize: 12, color: '#1565C0',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
        <span>
          Email notifications are sent to <strong>{' your registered email address'}</strong>.
          Some critical system alerts (account suspended, billing issues) may still be sent regardless of your preferences.
        </span>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10 }}>
        <Link href="/settings" className="btn btn-secondary">Cancel</Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : '💾 Save Preferences'}
        </button>
      </div>
    </>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: enabled ? 'var(--blue)' : 'var(--gray-300)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
      aria-checked={enabled}
      role="switch"
    >
      <span style={{
        position: 'absolute', top: 3,
        left: enabled ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}
