'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateProfile, changePassword, saveEmailConfig, sendTestEmail } from '@/actions/settings'
import { saveNotificationPrefs } from '@/actions/notifications'
import { saveHospitalConfig } from '@/actions/hospitalConfig'
import {
  APPROVAL_ROLE_LABELS,
  type HospitalConfig,
  type ApprovalRole,
} from '@/lib/hospitalConfig'

interface Props {
  profile: {
    full_name: string
    email: string
    phone: string
    job_title: string
    nursing_license: string
  }
  hospital: { name: string; city: string; contact_email: string } | null
  hasHospital: boolean
  role: string
  canEditWorkflow: boolean
  notifPrefs: Record<string, boolean>
  hospitalConfig: HospitalConfig | null
  emailConfig: Record<'smtp_host' | 'smtp_port' | 'smtp_secure' | 'smtp_user' | 'smtp_password' | 'smtp_from_email' | 'smtp_from_name', string> | null
  adminEmail: string
}

const NOTIF_CATEGORIES = [
  { key: 'assessments',  icon: '✅', label: 'Assessments',  desc: 'Assessment assigned, submitted, result notifications' },
  { key: 'approvals',    icon: '✍️', label: 'Approvals',    desc: 'Pending approval requests and decisions' },
  { key: 'transfers',    icon: '🔄', label: 'Transfers',    desc: 'Transfer requests and status updates' },
  { key: 'certificates', icon: '🏅', label: 'Certificates', desc: 'Certificate issued, expiry, renewal reminders' },
  { key: 'billing',      icon: '💳', label: 'Billing',      desc: 'Subscription expiry, payment reminders' },
  { key: 'system',       icon: '🔧', label: 'System',       desc: 'System alerts, maintenance notices' },
]

const ALL_APPROVAL_ROLES: ApprovalRole[] = ['unit_head', 'department_head', 'head_nurse', 'hospital_admin']

function getPref(prefs: Record<string, boolean>, key: string, fallback = true): boolean {
  return key in prefs ? Boolean(prefs[key]) : fallback
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: enabled ? 'var(--blue)' : 'var(--gray-300)',
        border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
      }}
      role="switch"
      aria-checked={enabled}
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

export default function SettingsClient({
  profile: initialProfile,
  hospital,
  hasHospital,
  role,
  canEditWorkflow,
  notifPrefs: initialPrefs,
  hospitalConfig: initialHospitalConfig,
  emailConfig: initialEmailConfig,
  adminEmail,
}: Props) {
  const isSuperAdmin = role === 'super_admin'

  // Tab state
  type Tab = 'profile' | 'security' | 'notifications' | 'hospital' | 'approval' | 'email'
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // Profile form state
  const [profile, setProfile] = useState(initialProfile)
  const [isSavingProfile, startSaveProfile] = useTransition()

  // Password state
  const [pw, setPw] = useState({ new_password: '', confirm_password: '' })
  const [isSavingPw, startSavePw] = useTransition()

  // Notification prefs state
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs)
  const [isSavingPrefs, startSavePrefs] = useTransition()

  // Hospital config state
  const [cfg, setCfg] = useState<HospitalConfig | null>(initialHospitalConfig)
  const [isSavingCfg, startSaveCfg] = useTransition()

  // Email config state
  type SmtpKey = 'smtp_host' | 'smtp_port' | 'smtp_secure' | 'smtp_user' | 'smtp_password' | 'smtp_from_email' | 'smtp_from_name'
  const SMTP_DEFAULTS: Record<SmtpKey, string> = {
    smtp_host: '', smtp_port: '587', smtp_secure: 'tls',
    smtp_user: '', smtp_password: '', smtp_from_email: '', smtp_from_name: 'CAMS',
  }
  const [emailCfg, setEmailCfg] = useState<Record<SmtpKey, string>>({ ...SMTP_DEFAULTS, ...(initialEmailConfig ?? {}) })
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [testEmail, setTestEmail] = useState(adminEmail)
  const [isSavingEmail, startSaveEmail] = useTransition()
  const [isSendingTest, startSendTest] = useTransition()

  // Build tab list based on role
  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'security', icon: '🔒', label: 'Security' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
  ]
  if (hasHospital) tabs.push({ id: 'hospital', icon: '🏥', label: 'Hospital' })
  if (hasHospital && cfg) tabs.push({ id: 'approval', icon: '⚙️', label: 'Approval Workflow' })
  if (isSuperAdmin) tabs.push({ id: 'email', icon: '📧', label: 'Email Config' })

  // Handlers
  function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startSaveProfile(async () => {
      const r = await updateProfile(fd)
      if (r.success) toast.success('Profile updated')
      else toast.error(r.error ?? 'Failed to update')
    })
  }

  function handleSavePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pw.new_password !== pw.confirm_password) { toast.error('Passwords do not match'); return }
    const fd = new FormData()
    fd.set('new_password', pw.new_password)
    fd.set('confirm_password', pw.confirm_password)
    startSavePw(async () => {
      const r = await changePassword(fd)
      if (r.success) { toast.success('Password updated'); setPw({ new_password: '', confirm_password: '' }) }
      else toast.error(r.error ?? 'Failed to update password')
    })
  }

  function togglePref(key: string) {
    setPrefs((p) => ({ ...p, [key]: !getPref(p, key) }))
  }

  function setAllPrefs(enabled: boolean) {
    const next: Record<string, boolean> = {}
    for (const { key } of NOTIF_CATEGORIES) {
      next[`inapp_${key}`] = enabled
      next[`email_${key}`] = enabled
    }
    setPrefs(next)
  }

  function handleSavePrefs() {
    const fd = new FormData()
    for (const { key } of NOTIF_CATEGORIES) {
      if (getPref(prefs, `inapp_${key}`)) fd.set(`inapp_${key}`, 'on')
      if (getPref(prefs, `email_${key}`)) fd.set(`email_${key}`, 'on')
    }
    startSavePrefs(async () => {
      const r = await saveNotificationPrefs(fd)
      if (r.success) toast.success('Preferences saved')
      else toast.error(r.error ?? 'Failed to save')
    })
  }

  function toggleStructure(key: keyof Pick<HospitalConfig, 'hasBranches' | 'hasDepartments' | 'hasUnits'>) {
    if (!cfg) return
    setCfg((c) => c ? { ...c, [key]: !c[key] } : c)
  }

  function toggleApprovalRole(r: ApprovalRole) {
    if (!cfg || r === 'hospital_admin') return
    setCfg((c) => c ? {
      ...c,
      approvalRoles: c.approvalRoles.includes(r)
        ? c.approvalRoles.filter((x) => x !== r)
        : [...c.approvalRoles, r],
    } : c)
  }

  function handleSaveCfg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!cfg) return
    const fd = new FormData()
    fd.set('hasBranches', String(cfg.hasBranches))
    fd.set('hasDepartments', String(cfg.hasDepartments))
    fd.set('hasUnits', String(cfg.hasUnits))
    cfg.approvalRoles.forEach((r) => fd.append('approvalRoles', r))
    startSaveCfg(async () => {
      const r = await saveHospitalConfig(fd)
      if (r.success) { toast.success('Configuration saved'); setTimeout(() => window.location.reload(), 1200) }
      else toast.error(r.error ?? 'Save failed')
    })
  }

  function handleSaveEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    for (const [k, v] of Object.entries(emailCfg)) fd.set(k, v)
    startSaveEmail(async () => {
      const r = await saveEmailConfig(fd)
      if (r.success) toast.success('SMTP configuration saved')
      else toast.error(r.error ?? 'Failed to save')
    })
  }

  function handleTestEmail() {
    if (!testEmail) { toast.error('Enter a test email address'); return }
    startSendTest(async () => {
      const r = await sendTestEmail(testEmail)
      if (r.success) toast.success(`Test email sent to ${testEmail}`)
      else toast.error(r.error ?? 'Test failed')
    })
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Settings</h1>
          <p>Manage your profile and preferences</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Sidebar nav */}
        <div className="card" style={{ width: 210, flexShrink: 0, padding: 8 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: activeTab === tab.id ? '#EBF3FF' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                color: activeTab === tab.id ? 'var(--blue)' : 'var(--gray-700)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>👤</span>
                  <div className="card-title">Profile Settings</div>
                </div>
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveProfile}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text" name="full_name" className="form-control"
                        value={profile.full_name}
                        onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email" className="form-control" value={profile.email}
                        readOnly disabled style={{ background: 'var(--gray-50)', color: 'var(--gray-500)' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="tel" name="phone" className="form-control"
                        value={profile.phone}
                        onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Job Title</label>
                      <input
                        type="text" name="job_title" className="form-control"
                        value={profile.job_title}
                        onChange={(e) => setProfile((p) => ({ ...p, job_title: e.target.value }))}
                      />
                    </div>
                    {!isSuperAdmin && (
                      <div className="form-group">
                        <label className="form-label">Nursing License</label>
                        <input
                          type="text" name="nursing_license" className="form-control"
                          value={profile.nursing_license}
                          onChange={(e) => setProfile((p) => ({ ...p, nursing_license: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={isSavingProfile}>
                      {isSavingProfile ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🔒</span>
                  <div className="card-title">Change Password</div>
                </div>
              </div>
              <div className="card-body">
                <form onSubmit={handleSavePassword}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input
                        type="password" className="form-control" placeholder="Min 8 characters"
                        value={pw.new_password}
                        onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))}
                        required minLength={8}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input
                        type="password" className="form-control" placeholder="Repeat new password"
                        value={pw.confirm_password}
                        onChange={(e) => setPw((p) => ({ ...p, confirm_password: e.target.value }))}
                        required minLength={8}
                      />
                    </div>
                  </div>
                  {pw.confirm_password && pw.new_password !== pw.confirm_password && (
                    <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>Passwords do not match</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={isSavingPw}>
                      {isSavingPw ? 'Updating…' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span>🔔</span>
                  <div className="card-title">Notification Preferences</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setAllPrefs(true)}>Enable All</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setAllPrefs(false)}>Disable All</button>
                </div>
              </div>

              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                padding: '10px 20px', borderBottom: '2px solid var(--gray-100)',
                fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <div>Notification Type</div>
                <div style={{ textAlign: 'center' }}>In-App 🔔</div>
                <div style={{ textAlign: 'center' }}>Email 📧</div>
              </div>

              {NOTIF_CATEGORIES.map((cat, i) => (
                <div key={cat.key} style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                  padding: '16px 20px',
                  borderBottom: i < NOTIF_CATEGORIES.length - 1 ? '1px solid var(--gray-100)' : 'none',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 16 }}>{cat.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{cat.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', paddingLeft: 24 }}>{cat.desc}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Toggle enabled={getPref(prefs, `inapp_${cat.key}`)} onToggle={() => togglePref(`inapp_${cat.key}`)} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Toggle enabled={getPref(prefs, `email_${cat.key}`, cat.key !== 'system')} onToggle={() => togglePref(`email_${cat.key}`)} />
                  </div>
                </div>
              ))}

              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSavePrefs} disabled={isSavingPrefs}>
                  {isSavingPrefs ? 'Saving…' : '💾 Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* HOSPITAL TAB */}
          {activeTab === 'hospital' && (
            <>
              <div className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🏥</span>
                    <div className="card-title">Hospital Information</div>
                  </div>
                </div>
                <div className="card-body">
                  {hospital ? (
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Hospital Name</label>
                        <input type="text" className="form-control" value={hospital.name} readOnly disabled style={{ background: 'var(--gray-50)', color: 'var(--gray-600)' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">City</label>
                        <input type="text" className="form-control" value={hospital.city ?? ''} readOnly disabled style={{ background: 'var(--gray-50)', color: 'var(--gray-600)' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contact Email</label>
                        <input type="email" className="form-control" value={hospital.contact_email ?? ''} readOnly disabled style={{ background: 'var(--gray-50)', color: 'var(--gray-600)' }} />
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>No hospital information available.</p>
                  )}
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#E3F2FD', borderRadius: 8, fontSize: 12, color: '#1565C0' }}>
                    ℹ️ Hospital information is managed by your Super Administrator. Contact them to make changes.
                  </div>
                </div>
              </div>

              {/* Show active structure summary for all hospital users */}
              {cfg && (
                <div className="card">
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🏗️</span>
                      <div>
                        <div className="card-title">Active Structure & Workflow</div>
                        <div className="card-subtitle">Your hospital's current organisational setup</div>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                      {[
                        { label: 'Branches', enabled: cfg.hasBranches, icon: '🏢' },
                        { label: 'Departments', enabled: cfg.hasDepartments, icon: '🏬' },
                        { label: 'Units', enabled: cfg.hasUnits, icon: '🔲' },
                      ].map((s) => (
                        <div key={s.label} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8,
                          background: s.enabled ? '#E8F5E9' : 'var(--gray-50)',
                          border: `1px solid ${s.enabled ? '#A5D6A7' : 'var(--gray-200)'}`,
                          fontSize: 13,
                        }}>
                          <span>{s.icon}</span>
                          <span style={{ fontWeight: 600, color: s.enabled ? 'var(--green)' : 'var(--gray-400)' }}>{s.label}</span>
                          <span style={{ fontSize: 11, color: s.enabled ? 'var(--green)' : 'var(--gray-400)' }}>{s.enabled ? '✓ Active' : '✗ Off'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12, color: 'var(--gray-600)' }}>
                      <strong>Approval chain:</strong> Staff submits →{' '}
                      {cfg.approvalRoles.filter((r) => r !== 'hospital_admin').map((r) => APPROVAL_ROLE_LABELS[r]).join(' → ')}
                      {cfg.approvalRoles.filter((r) => r !== 'hospital_admin').length > 0 ? ' → ' : ' '}
                      Hospital Admin → Certificate issued
                    </div>
                    {canEditWorkflow && (
                      <div style={{ marginTop: 12 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('approval')}>
                          ⚙️ Edit Workflow Configuration
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* APPROVAL WORKFLOW TAB */}
          {activeTab === 'approval' && cfg && (
            <form onSubmit={canEditWorkflow ? handleSaveCfg : (e) => e.preventDefault()}>
              {!canEditWorkflow && (
                <div style={{ marginBottom: 16, padding: '10px 16px', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 8, fontSize: 13, color: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
                  👁️ <span>You can view but not change this configuration. Contact your Hospital Administrator to make changes.</span>
                </div>
              )}
              {/* Structure section */}
              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">🏗️ Hospital Structure</div>
                    <div className="card-subtitle">{canEditWorkflow ? 'Choose which organisational levels apply to your hospital' : 'Active organisational levels for your hospital'}</div>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {([
                    { key: 'hasBranches' as const, icon: '🏢', label: 'Branches', desc: 'Physical locations or campuses', warning: 'Disabling will hide the Branches menu.' },
                    { key: 'hasDepartments' as const, icon: '🏬', label: 'Departments', desc: 'Organisational units within a branch', warning: 'Disabling will hide the Departments menu.' },
                    { key: 'hasUnits' as const, icon: '🔲', label: 'Units', desc: 'Sub-groups within a department', warning: 'Disabling will hide the Units menu.' },
                  ]).map(({ key, icon, label, desc, warning }) => (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', borderRadius: 10,
                      border: `1px solid ${cfg[key] ? 'var(--blue)' : 'var(--gray-200)'}`,
                      background: cfg[key] ? '#EBF5FB' : 'var(--gray-50)', transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{desc}</div>
                        {!cfg[key] && (
                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 6, background: '#FFF8E1', padding: '4px 8px', borderRadius: 5, border: '1px solid #FFE082' }}>
                            ⚠️ {warning}
                          </div>
                        )}
                      </div>
                      <div onClick={() => canEditWorkflow && toggleStructure(key)} style={{
                        width: 44, height: 24, borderRadius: 99, cursor: canEditWorkflow ? 'pointer' : 'not-allowed', flexShrink: 0, marginTop: 4,
                        background: cfg[key] ? 'var(--blue)' : 'var(--gray-300)', position: 'relative', transition: 'background 0.2s',
                        opacity: canEditWorkflow ? 1 : 0.7,
                      }}>
                        <div style={{
                          position: 'absolute', top: 3, left: cfg[key] ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12, color: 'var(--gray-600)' }}>
                    <strong>Active structure:</strong>{' '}
                    {[cfg.hasBranches && 'Branches', cfg.hasDepartments && 'Departments', cfg.hasUnits && 'Units'].filter(Boolean).join(' → ') || 'No hierarchy (flat)'}
                  </div>
                </div>
              </div>

              {/* Approval chain section */}
              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">✅ Approval Workflow</div>
                    <div className="card-subtitle">{canEditWorkflow ? 'Select which roles must approve before a certificate is issued' : 'Current approval chain for your hospital'}. Hospital Admin is always the final approver.</div>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ALL_APPROVAL_ROLES.map((r) => {
                    const checked = cfg.approvalRoles.includes(r)
                    const locked = r === 'hospital_admin'
                    return (
                      <label key={r} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 8, cursor: locked ? 'default' : 'pointer',
                        border: `1px solid ${checked ? 'var(--blue)' : 'var(--gray-200)'}`,
                        background: checked ? '#EBF5FB' : 'var(--gray-50)', opacity: locked ? 0.75 : 1,
                      }}>
                        <input
                          type="checkbox" checked={checked} disabled={locked || !canEditWorkflow}
                          onChange={() => canEditWorkflow && toggleApprovalRole(r)}
                          style={{ width: 16, height: 16, accentColor: 'var(--blue)', cursor: (locked || !canEditWorkflow) ? 'default' : 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>
                            {APPROVAL_ROLE_LABELS[r]}
                            {locked && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>(always required)</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            {r === 'unit_head' && 'Reviews assessment at unit level'}
                            {r === 'department_head' && 'Reviews assessment at department level'}
                            {r === 'head_nurse' && 'Reviews assessment for clinical sign-off'}
                            {r === 'hospital_admin' && 'Final approval — issues the certificate'}
                          </div>
                        </div>
                        {checked && !locked && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: '#BBDEFB', padding: '2px 8px', borderRadius: 99 }}>Active</span>
                        )}
                      </label>
                    )
                  })}
                  <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12, color: 'var(--gray-600)' }}>
                    <strong>Approval chain:</strong> Staff submits →{' '}
                    {cfg.approvalRoles.filter((r) => r !== 'hospital_admin').map((r) => APPROVAL_ROLE_LABELS[r]).join(' → ')}
                    {cfg.approvalRoles.filter((r) => r !== 'hospital_admin').length > 0 ? ' → ' : ' '}
                    Hospital Admin → Certificate issued
                  </div>
                </div>
              </div>

              {canEditWorkflow && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={isSavingCfg}>
                    {isSavingCfg ? 'Saving…' : 'Save Configuration'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* EMAIL CONFIG TAB (super_admin only) */}
          {activeTab === 'email' && isSuperAdmin && (
            <>
              <form onSubmit={handleSaveEmail} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* SMTP Server */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">📡 SMTP Server</div>
                    <div className="card-subtitle">Connection details for your outgoing mail server</div>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12, marginBottom: 14 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">SMTP Host</label>
                        <input
                          type="text" className="form-control"
                          value={emailCfg.smtp_host}
                          onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_host: e.target.value }))}
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Port</label>
                        <input
                          type="number" className="form-control"
                          value={emailCfg.smtp_port}
                          onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_port: e.target.value }))}
                          placeholder="587" min={1} max={65535}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Encryption</label>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {([
                          { value: 'tls', label: 'STARTTLS', port: '587', badge: 'Recommended' },
                          { value: 'ssl', label: 'SSL/TLS', port: '465', badge: 'Legacy' },
                          { value: 'none', label: 'None', port: '25', badge: 'Insecure' },
                        ] as const).map((opt) => (
                          <label
                            key={opt.value}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 12px', borderRadius: 8, cursor: 'pointer', flex: 1,
                              border: `1px solid ${emailCfg.smtp_secure === opt.value ? 'var(--blue)' : 'var(--gray-200)'}`,
                              background: emailCfg.smtp_secure === opt.value ? '#EBF3FF' : 'var(--gray-50)',
                            }}
                          >
                            <input
                              type="radio" name="smtp_secure" value={opt.value}
                              checked={emailCfg.smtp_secure === opt.value}
                              onChange={() => setEmailCfg((c) => ({ ...c, smtp_secure: opt.value, smtp_port: opt.port }))}
                              style={{ accentColor: 'var(--blue)' }}
                            />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{opt.label} (:{opt.port})</div>
                              <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{opt.badge}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Authentication */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">🔑 Authentication</div>
                    <div className="card-subtitle">SMTP login credentials</div>
                  </div>
                  <div className="card-body">
                    <div className="form-group">
                      <label className="form-label">Username / Email</label>
                      <input
                        type="text" className="form-control" autoComplete="username"
                        value={emailCfg.smtp_user}
                        onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_user: e.target.value }))}
                        placeholder="you@gmail.com"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Password / App Password</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type={showSmtpPassword ? 'text' : 'password'}
                          className="form-control" autoComplete="current-password"
                          value={emailCfg.smtp_password}
                          onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_password: e.target.value }))}
                          placeholder="••••••••••••••••"
                          style={{ flex: 1, fontFamily: 'monospace' }}
                        />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSmtpPassword((s) => !s)} style={{ minWidth: 70 }}>
                          {showSmtpPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                        For Gmail, use an <strong>App Password</strong> (requires 2FA enabled). Falls back to <code>SMTP_PASSWORD</code> env var.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sender identity */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">✉️ Sender Identity</div>
                    <div className="card-subtitle">How recipients will see the &quot;From&quot; field</div>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">From Name</label>
                        <input
                          type="text" className="form-control"
                          value={emailCfg.smtp_from_name}
                          onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_from_name: e.target.value }))}
                          placeholder="CAMS"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">From Email</label>
                        <input
                          type="email" className="form-control"
                          value={emailCfg.smtp_from_email}
                          onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_from_email: e.target.value }))}
                          placeholder="noreply@yourdomain.com"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <button type="submit" className="btn btn-primary" disabled={isSavingEmail}>
                      {isSavingEmail ? 'Saving…' : 'Save SMTP Configuration'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Test email */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Send Test Email</div>
                  <div className="card-subtitle">Verify the current SMTP settings by sending a test message</div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 280px' }}>
                      <label className="form-label">Recipient Email</label>
                      <input
                        type="email" className="form-control"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="test@example.com"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ paddingTop: 22 }}>
                      <button
                        type="button" className="btn btn-secondary"
                        onClick={handleTestEmail}
                        disabled={isSendingTest || !testEmail}
                      >
                        {isSendingTest ? 'Sending…' : '📧 Send Test'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
