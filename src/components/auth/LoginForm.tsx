'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { toast } from 'sonner'

const roles = [
  { id: 'super_admin', icon: '👑', name: 'Super Admin', sub: 'SaaS Owner' },
  { id: 'hospital_admin', icon: '🏥', name: 'Hospital Admin', sub: 'Hospital Level' },
  { id: 'head_nurse', icon: '👩‍⚕️', name: 'Head Nurse', sub: 'Unit Manager' },
  { id: 'assessor', icon: '🩺', name: 'Assessor', sub: 'Clinical' },
  { id: 'staff', icon: '👤', name: 'Staff Nurse', sub: 'Clinical Staff' },
  { id: 'auditor', icon: '🔍', name: 'Auditor', sub: 'Read Only' },
]

const MESSAGE_LABELS: Record<string, string> = {
  account_pending: 'Your account profile could not be found. Please contact your administrator.',
  password_updated: 'Password updated successfully. Please sign in.',
}

export function LoginForm({ serverError, serverMessage }: { serverError?: string; serverMessage?: string }) {
  const [showPw, setShowPw] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(serverError ?? null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await login(formData)
      if (result && !result.success) {
        setError(result.error ?? 'Login failed')
        toast.error(result.error ?? 'Login failed')
      }
    })
  }

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
      {/* Left panel */}
      <div style={{
        width: 420, flexShrink: 0,
        background: 'linear-gradient(160deg,#0B1F3A 0%,#1565C0 55%,#0288D1 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 40, position: 'relative', overflow: 'hidden',
      }}>
        {/* Pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, backdropFilter: 'blur(8px)' }}>🏥</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>CAMS</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>Competency Assessment Management System</p>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1.3, marginBottom: 14 }}>
            Clinical Excellence<br />Through Verified<br />Competency
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: 32 }}>
            CAMS ensures every clinical staff member is assessed, certified, and compliant — reducing risk, improving outcomes, and satisfying CBAHI audit requirements.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '🏅', title: 'Triple Signature Certification', sub: 'Tamper-proof digital sign-off chain' },
              { icon: '🔁', title: 'Automated Renewal Alerts', sub: '90/60/30/7-day escalation system' },
              { icon: '📊', title: 'Real-Time Compliance Dashboard', sub: 'Live KPIs for all management levels' },
            ].map((f) => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>© 2025 CAMS · Saudi Arabia</span>
          <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 12px', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>🇸🇦 CBAHI Ready</div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Welcome Back</h2>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 32 }}>Sign in to your CAMS account</p>

          {serverMessage && (
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              ⚠️ {MESSAGE_LABELS[serverMessage] ?? serverMessage}
            </div>
          )}

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}

          <form action={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                name="email"
                type="email"
                className="form-control"
                placeholder="your@hospital.med.sa"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  className="form-control"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', background: 'none', border: 'none', fontSize: 15, color: 'var(--gray-500)' }}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={isPending}
              style={{ background: 'linear-gradient(135deg,#1565C0,#0288D1)', marginBottom: 16 }}
            >
              {isPending ? (
                <>⏳ Authenticating…</>
              ) : (
                <>🔐 Sign In to CAMS</>
              )}
            </button>
          </form>

          <div className="divider" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', fontSize: 12, color: 'var(--gray-300)' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
            <span>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
          </div>

          <button className="btn btn-secondary btn-full" style={{ marginBottom: 16 }}>
            🏢 Sign in with Hospital SSO
          </button>

          <p style={{ textAlign: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Don&apos;t have an account? </span>
            <Link href="/register" style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
              Request Access
            </Link>
          </p>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Link
              href="/signup"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                color: 'white',
                background: 'linear-gradient(135deg,#2E7D32,#388E3C)',
                padding: '8px 18px', borderRadius: 8,
              }}
            >
              🏥 Register Your Hospital
            </Link>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 5 }}>
              New hospital? Start your free trial
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
            CAMS · Clinical Competency Assessment System
          </p>
        </div>
      </div>
    </div>
  )
}
