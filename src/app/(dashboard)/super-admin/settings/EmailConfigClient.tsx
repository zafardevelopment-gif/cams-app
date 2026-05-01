'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveEmailConfig, sendTestEmail } from '@/actions/settings'

interface Props {
  initialResendKey: string
  initialEmailFrom: string
  adminEmail: string
}

export default function EmailConfigClient({ initialResendKey, initialEmailFrom, adminEmail }: Props) {
  const [resendKey, setResendKey] = useState(initialResendKey)
  const [emailFrom, setEmailFrom] = useState(initialEmailFrom)
  const [showKey, setShowKey] = useState(false)
  const [testEmail, setTestEmail] = useState(adminEmail)
  const [isSaving, startSave] = useTransition()
  const [isTesting, startTest] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('resend_api_key', resendKey)
    fd.set('email_from', emailFrom)
    startSave(async () => {
      const result = await saveEmailConfig(fd)
      if (result.success) toast.success('Email configuration saved')
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
    <div style={{ maxWidth: 640 }}>
      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">Email Provider (Resend)</div>
            <div className="card-subtitle">Configure the API key and sender address used for all system emails</div>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Resend API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  className="form-input"
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowKey((s) => !s)}
                  style={{ minWidth: 70 }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                Get your API key from{' '}
                <span style={{ color: 'var(--blue)' }}>resend.com/api-keys</span>.
                If blank, falls back to the <code>RESEND_API_KEY</code> env var.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">From Address</label>
              <input
                type="text"
                className="form-input"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                placeholder="CAMS <noreply@yourdomain.com>"
              />
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                Must be a verified domain in Resend. Falls back to <code>EMAIL_FROM</code> env var.
              </p>
            </div>
          </div>
          <div className="card-footer">
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </form>

      {/* Test email */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Send Test Email</div>
          <div className="card-subtitle">Verify the current configuration by sending a test message</div>
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
