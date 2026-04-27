import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDate, daysUntil } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import CertificateActions from '@/components/certificates/CertificateActions'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = { active: 'badge-green', expiring_soon: 'badge-yellow', expired: 'badge-red', revoked: 'badge-gray' }
const STATUS_LABEL: Record<string, string> = { active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired', revoked: 'Revoked' }

export default async function CertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: cert } = await admin
    .from(T.certificates)
    .select(`*, staff:${J.users}!staff_id(full_name, job_title, employee_id, department:${J.departments}!department_id(name), hospital:${J.hospitals}!hospital_id(name)), template:${J.competency_templates}!template_id(title, category, validity_months, passing_score), assessment:${J.assessments}!assessment_id(knowledge_score, quiz_score, practical_score, assessor:${J.users}!assessor_id(full_name))`)
    .eq('id', id)
    .single()

  if (!cert) notFound()

  const staffRaw = cert.staff as unknown
  const templateRaw = cert.template as unknown
  const assessmentRaw = cert.assessment as unknown

  const staff = (Array.isArray(staffRaw) ? staffRaw[0] : staffRaw) as { full_name: string; job_title: string; employee_id?: string; department?: { name: string } | { name: string }[]; hospital?: { name: string } | { name: string }[] } | null
  const template = (Array.isArray(templateRaw) ? templateRaw[0] : templateRaw) as { title: string; category: string; validity_months: number; passing_score: number } | null
  const assessment = (Array.isArray(assessmentRaw) ? assessmentRaw[0] : assessmentRaw) as { knowledge_score?: number; quiz_score?: number; practical_score?: number; assessor?: { full_name: string } | { full_name: string }[] } | null

  const deptRaw = staff?.department
  const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw as { name: string } | null
  const hospitalRaw = staff?.hospital
  const hospital = Array.isArray(hospitalRaw) ? hospitalRaw[0] : hospitalRaw as { name: string } | null
  const assessorRaw = assessment?.assessor
  const assessor = Array.isArray(assessorRaw) ? assessorRaw[0] : assessorRaw as { full_name: string } | null

  const days = daysUntil(cert.expiry_date)

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Certificate Details</h1>
          <p>{cert.certificate_number}</p>
        </div>
        <div className="page-header-actions">
          <Link href="/certificates" className="btn btn-secondary btn-sm">← Back</Link>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1565C0 60%, #0288D1 100%)', borderRadius: 16, padding: 32, color: 'white', position: 'relative', overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'rgba(255,255,255,0.04)', borderRadius: '50%', transform: 'translate(30%, -30%)' }} />
            <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Certificate of Competency</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{template?.title ?? '—'}</h2>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 24 }}>{template?.category ?? '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👩‍⚕️</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{staff?.full_name ?? '—'}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{staff?.job_title ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{dept?.name ?? '—'} · {hospital?.name ?? '—'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Score', value: cert.overall_score != null ? `${cert.overall_score}%` : '—' },
                { label: 'Issued', value: formatDate(cert.issued_date) },
                { label: 'Expires', value: formatDate(cert.expiry_date) },
              ].map((item) => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {cert.certificate_number} · CAMS Verified · <span style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 6px', borderRadius: 4 }}>{cert.status === 'active' ? '● VALID' : cert.status.toUpperCase()}</span>
            </div>
          </div>

          <CertificateActions cert={{
            certificateNumber: cert.certificate_number, staffName: staff?.full_name ?? '—', jobTitle: staff?.job_title ?? '—',
            department: dept?.name ?? '—', hospital: hospital?.name ?? '—', templateTitle: template?.title ?? '—',
            templateCategory: template?.category ?? '—', overallScore: cert.overall_score ?? 0,
            issuedDate: formatDate(cert.issued_date), expiryDate: formatDate(cert.expiry_date),
            validityMonths: template?.validity_months ?? 12, employeeId: staff?.employee_id ?? '—',
          }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Certificate Information</div>
              <span className={`badge ${STATUS_BADGE[cert.status] ?? 'badge-gray'}`}>{STATUS_LABEL[cert.status] ?? cert.status}</span>
            </div>
            <div className="card-body">
              <div className="stat-row"><span className="stat-label">Certificate Number</span><span className="stat-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{cert.certificate_number}</span></div>
              <div className="stat-row"><span className="stat-label">Issued Date</span><span className="stat-value">{formatDate(cert.issued_date)}</span></div>
              <div className="stat-row">
                <span className="stat-label">Expiry Date</span>
                <span className="stat-value">
                  {formatDate(cert.expiry_date)}
                  {days > 0 && days <= 90 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--amber)' }}>({days} days left)</span>}
                  {days < 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--red)' }}>(Expired)</span>}
                </span>
              </div>
              <div className="stat-row"><span className="stat-label">Validity</span><span className="stat-value">{template?.validity_months ?? '—'} months</span></div>
            </div>
          </div>

          {(assessment?.knowledge_score != null || assessment?.quiz_score != null || assessment?.practical_score != null) && (
            <div className="card">
              <div className="card-header"><div className="card-title">Assessment Scores</div></div>
              <div className="card-body">
                {[
                  { label: 'Knowledge', value: assessment?.knowledge_score, color: 'var(--blue)' },
                  { label: 'Quiz', value: assessment?.quiz_score, color: 'var(--purple)' },
                  { label: 'Practical', value: assessment?.practical_score, color: 'var(--teal)' },
                ].filter((s) => s.value != null).map((s) => (
                  <div key={s.label} style={{ marginBottom: 10 }}>
                    <div className="flex-between mb-4"><span className="text-sm fw-600">{s.label}</span><span className="text-sm fw-600">{s.value}%</span></div>
                    <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${s.value}%`, background: s.color }} /></div>
                  </div>
                ))}
                {assessor && <div className="stat-row" style={{ marginTop: 12 }}><span className="stat-label">Assessed By</span><span className="stat-value">{assessor.full_name}</span></div>}
              </div>
            </div>
          )}

          {days > 0 && days <= 90 && (
            <div className="alert alert-warning">
              ⚠️ This certificate expires in <strong>{days} days</strong>. Start renewal process to maintain compliance.
              <div style={{ marginTop: 10 }}><Link href="/renewals" className="btn btn-primary btn-sm">Start Renewal</Link></div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
