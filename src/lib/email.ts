// Email helper — uses Resend when RESEND_API_KEY is set.
// API key and FROM address are resolved from CAMS_settings DB table first,
// then fall back to environment variables.
// Falls back to console.log in dev / when key is absent.

interface EmailPayload {
  to: string
  subject: string
  html: string
}

async function resolveEmailConfig(): Promise<{ apiKey: string | null; from: string }> {
  try {
    // Dynamic import to avoid circular deps — email.ts is imported by actions
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('CAMS_settings')
      .select('key, value')
      .in('key', ['resend_api_key', 'email_from'])
      .is('hospital_id', null)

    const dbKey = rows?.find((r) => r.key === 'resend_api_key')?.value as string | undefined
    const dbFrom = rows?.find((r) => r.key === 'email_from')?.value as string | undefined

    return {
      apiKey: (dbKey || process.env.RESEND_API_KEY) ?? null,
      from: dbFrom || process.env.EMAIL_FROM || 'CAMS <noreply@cams.sa>',
    }
  } catch {
    return {
      apiKey: process.env.RESEND_API_KEY ?? null,
      from: process.env.EMAIL_FROM ?? 'CAMS <noreply@cams.sa>',
    }
  }
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { apiKey, from } = await resolveEmailConfig()

  if (!apiKey) {
    // Dev / no-op — log instead of fail
    console.log('[email] (no RESEND_API_KEY — not sent)', payload.to, payload.subject)
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: payload.to, subject: payload.subject, html: payload.html }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[email] Resend error:', res.status, text)
    }
  } catch (err) {
    console.error('[email] Failed to send:', err)
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>CAMS Notification</title>
<style>
  body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F0F4F8;color:#1B2B3B}
  .wrap{max-width:560px;margin:32px auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#0B1F3A,#1565C0);padding:24px 32px;display:flex;align-items:center;gap:12px}
  .hdr-logo{font-size:28px}
  .hdr-title{color:white;font-size:18px;font-weight:700;margin:0}
  .hdr-sub{color:rgba(255,255,255,.65);font-size:12px;margin:2px 0 0}
  .body{padding:28px 32px}
  .btn{display:inline-block;padding:11px 24px;background:#1565C0;color:white!important;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px}
  .footer{background:#F8FAFC;padding:16px 32px;font-size:11px;color:#9AA5B4;border-top:1px solid #E4E9EF;text-align:center}
  p{line-height:1.6;margin:0 0 12px}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-logo">🏥</div>
    <div>
      <div class="hdr-title">CAMS</div>
      <div class="hdr-sub">Competency Assessment Management System</div>
    </div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">This is an automated notification from CAMS. Please do not reply to this email.</div>
</div>
</body>
</html>`
}

export function emailAssessmentAssigned(staffName: string, templateTitle: string, assessmentUrl: string): string {
  return baseTemplate(`
    <p>Hi <strong>${staffName}</strong>,</p>
    <p>A new competency assessment has been assigned to you:</p>
    <p style="background:#E3F2FD;border-left:4px solid #1565C0;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
      <strong>📋 ${templateTitle}</strong>
    </p>
    <p>Please complete this assessment before the due date. Log in to CAMS to get started.</p>
    <a href="${assessmentUrl}" class="btn">View Assessment →</a>
  `)
}

export function emailAssessmentResult(staffName: string, templateTitle: string, passed: boolean, score: number): string {
  const icon = passed ? '✅' : '❌'
  const color = passed ? '#2E7D32' : '#B71C1C'
  const bg = passed ? '#E8F5E9' : '#FFEBEE'
  return baseTemplate(`
    <p>Hi <strong>${staffName}</strong>,</p>
    <p>Your assessment result is ready:</p>
    <div style="background:${bg};border-radius:10px;padding:16px 20px;margin:16px 0;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">${icon}</div>
      <div style="font-weight:700;font-size:16px;color:${color}">${passed ? 'PASSED' : 'NOT PASSED'}</div>
      <div style="font-size:13px;color:#6B8299;margin-top:4px">${templateTitle} — Score: ${score}%</div>
    </div>
    <p>${passed ? 'Congratulations! Your certificate has been issued.' : 'You may be eligible to reattempt this assessment. Please contact your supervisor.'}</p>
    <a href="/assessments" class="btn">${passed ? 'View Certificate →' : 'View Assessment →'}</a>
  `)
}

export function emailTransferRequest(staffName: string, recipientName: string, actionUrl: string): string {
  return baseTemplate(`
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>A transfer request has been submitted for <strong>${staffName}</strong> and requires your review.</p>
    <a href="${actionUrl}" class="btn">Review Transfer →</a>
  `)
}

export function emailCertificateExpiry(staffName: string, templateTitle: string, expiryDate: string, daysLeft: number): string {
  return baseTemplate(`
    <p>Hi <strong>${staffName}</strong>,</p>
    <p>Your competency certificate is expiring soon:</p>
    <p style="background:#FFF8E1;border-left:4px solid #F9A825;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
      <strong>🏅 ${templateTitle}</strong><br />
      <span style="font-size:13px;color:#6B8299">Expires: ${expiryDate} (${daysLeft} days left)</span>
    </p>
    <p>Please initiate a renewal to maintain your compliance status.</p>
    <a href="/renewals" class="btn">Start Renewal →</a>
  `)
}

export function emailSubscriptionExpiry(hospitalName: string, planName: string, expiryDate: string, daysLeft: number): string {
  return baseTemplate(`
    <p>Hi,</p>
    <p>The <strong>${planName}</strong> subscription for <strong>${hospitalName}</strong> is expiring soon:</p>
    <p style="background:#FFEBEE;border-left:4px solid #EF5350;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
      <strong>⚠️ Expires: ${expiryDate} (${daysLeft} days left)</strong>
    </p>
    <p>Please renew your subscription to avoid service interruption.</p>
    <a href="/billing" class="btn">Renew Subscription →</a>
  `)
}

export function emailLicenseExpiry(staffName: string, expiryDate: string, daysLeft: number): string {
  return baseTemplate(`
    <p>Hi <strong>${staffName}</strong>,</p>
    <p>Your nursing license is expiring soon:</p>
    <p style="background:#FFF3E0;border-left:4px solid #FF9800;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
      <strong>📋 License Expiry: ${expiryDate} (${daysLeft} days left)</strong>
    </p>
    <p>Please renew your license and update it in CAMS to stay compliant.</p>
    <a href="/settings" class="btn">Update License →</a>
  `)
}
