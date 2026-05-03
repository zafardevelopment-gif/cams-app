'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveEmailConfig, sendTestEmail } from '@/actions/settings'

type SmtpKey = 'smtp_host' | 'smtp_port' | 'smtp_secure' | 'smtp_user' | 'smtp_password' | 'smtp_from_email' | 'smtp_from_name'

interface Props {
  initialSmtp: Record<SmtpKey, string>
  adminEmail: string
}

const EMPTY: Record<SmtpKey, string> = {
  smtp_host: '',
  smtp_port: '587',
  smtp_secure: 'tls',
  smtp_user: '',
  smtp_password: '',
  smtp_from_email: '',
  smtp_from_name: 'CAMS',
}

export default function EmailConfigClient({ initialSmtp, adminEmail }: Props) {
  const [cfg, setCfg] = useState<Record<SmtpKey, string>>({ ...EMPTY, ...initialSmtp })
  const [showPassword, setShowPassword] = useState(false)
  const [testEmail, setTestEmail] = useState(adminEmail)
  const [isSaving, startSave] = useTransition()
  const [isTesting, startTest] = useTransition()

  function set(key: SmtpKey, value: string) {
    setCfg((c) => ({ ...c, [key]: value }))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    for (const [k, v] of Object.entries(cfg)) fd.set(k, v)
    startSave(async () => {
      const result = await saveEmailConfig(fd)
      if (result.success) toast.success('SMTP configuration saved')
      else toast.error(result.error ?? 'Failed to save')
    })
  }

  function handleTest() {
    if (!testEmail) { toast.error('Enter a test email address'); return }
    startTest(async () => {
      const result = await sendTestEmail(testEmail)
      if (result.success) toast.success(`Test email sent to ${testEmail}`)
      else toast.error(result.error ?? 'Test failed')
    })
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <form onSubmit={handleSave}>
        {/* Server settings */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">SMTP Server</div>
            <div className="card-subtitle">Connection details for your outgoing mail server</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">SMTP Host</label>
                <input
                  type="text"
                  className="form-input"
                  value={cfg.smtp_host}
                  onChange={(e) => set('smtp_host', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Port</label>
                <input
                  type="number"
                  className="form-input"
                  value={cfg.smtp_port}
                  onChange={(e) => set('smtp_port', e.target.value)}
                  placeholder="587"
                  min={1}
                  max={65535}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Encryption</label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {[
                  { value: 'tls', label: 'STARTTLS (port 587)', desc: 'Recommended' },
                  { value: 'ssl', label: 'SSL/TLS (port 465)', desc: 'Legacy' },
                  { value: 'none', label: 'None (port 25)', desc: 'Not recommended' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer', flex: 1,
                      border: `1px solid ${cfg.smtp_secure === opt.value ? 'var(--blue)' : 'var(--gray-200)'}`,
                      background: cfg.smtp_secure === opt.value ? '#EBF3FF' : 'var(--gray-50)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="smtp_secure"
                      value={opt.value}
                      checked={cfg.smtp_secure === opt.value}
                      onChange={() => {
                        set('smtp_secure', opt.value)
                        if (opt.value === 'ssl') set('smtp_port', '465')
                        else if (opt.value === 'tls') set('smtp_port', '587')
                        else if (opt.value === 'none') set('smtp_port', '25')
                      }}
                      style={{ accentColor: 'var(--blue)' }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">Authentication</div>
            <div className="card-subtitle">SMTP login credentials</div>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Username / Email</label>
              <input
                type="text"
                className="form-input"
                value={cfg.smtp_user}
                onChange={(e) => set('smtp_user', e.target.value)}
                placeholder="you@gmail.com"
                autoComplete="username"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password / App Password</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={cfg.smtp_password}
                  onChange={(e) => set('smtp_password', e.target.value)}
                  placeholder="••••••••••••••••"
                  autoComplete="current-password"
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{ minWidth: 70 }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                For Gmail, use an <strong>App Password</strong> (requires 2FA). Falls back to <code>SMTP_PASSWORD</code> env var if blank.
              </p>
            </div>
          </div>
        </div>

        {/* Sender identity */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">Sender Identity</div>
            <div className="card-subtitle">How recipients will see the &quot;From&quot; field</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={cfg.smtp_from_name}
                  onChange={(e) => set('smtp_from_name', e.target.value)}
                  placeholder="CAMS"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={cfg.smtp_from_email}
                  onChange={(e) => set('smtp_from_email', e.target.value)}
                  placeholder="noreply@yourdomain.com"
                />
              </div>
            </div>
          </div>
          <div className="card-footer">
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save SMTP Configuration'}
            </button>
          </div>
        </div>
      </form>

      {/* Test email */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Send Test Email</div>
          <div className="card-subtitle">Verify your SMTP settings by sending a test message</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Recipient</label>
              <input
                type="email"
                className="form-input"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={isTesting}
            >
              {isTesting ? 'Sending…' : '📧 Send Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
