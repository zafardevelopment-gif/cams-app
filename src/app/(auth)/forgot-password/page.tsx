'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { forgotPassword } from '@/actions/auth'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await forgotPassword(formData)
      if (result.success) {
        setSent(true)
        toast.success('Reset email sent!')
      } else {
        toast.error(result.error ?? 'Failed to send reset email')
      }
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#1565C0,#0288D1)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>🔑</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>Reset Password</h2>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 6 }}>
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        {sent ? (
          <div className="alert alert-success" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📧</div>
            <strong>Check your inbox</strong>
            <p style={{ marginTop: 8, fontSize: 13 }}>
              A password reset link has been sent. Check your email to continue.
            </p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <form action={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    className="form-control"
                    placeholder="your@hospital.sa"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={isPending}
                >
                  {isPending ? '⏳ Sending…' : '📧 Send Reset Link'}
                </button>
              </form>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--gray-500)' }}>
          <Link href="/login" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
