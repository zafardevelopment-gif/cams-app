'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { editUser, archiveUser, restoreUser, adminResetPassword, requestTransfer } from '@/actions/staff'
import { getRoleLabel, getInitials, getAvatarColor } from '@/lib/utils'
import type { ProfileHistory, UserRole } from '@/types'

const ROLES = ['staff','assessor','educator','head_nurse','unit_head','department_head','hr_quality','branch_admin','hospital_admin','auditor'] as const
const STATUS_BADGE: Record<string, string> = { active: 'badge-green', pending: 'badge-yellow', inactive: 'badge-gray', suspended: 'badge-red' }
const CERT_BADGE:   Record<string, string> = { active: 'badge-green', expiring_soon: 'badge-amber', expired: 'badge-red', revoked: 'badge-gray' }
const ASSESS_BADGE: Record<string, string> = { passed: 'badge-green', failed: 'badge-red', in_progress: 'badge-blue', submitted: 'badge-purple', assessor_review: 'badge-blue', head_nurse_review: 'badge-teal', admin_review: 'badge-navy', not_started: 'badge-gray' }

function nameOf(raw: unknown) {
  const obj = Array.isArray(raw) ? raw[0] : raw as { name?: string } | null
  return obj?.name ?? '—'
}

function idOf(raw: unknown) {
  const obj = Array.isArray(raw) ? raw[0] : raw as { id?: string } | null
  return obj?.id ?? ''
}

interface Props {
  staff: Record<string, unknown>
  history: ProfileHistory[]
  assessments: Record<string, unknown>[]
  certs: Record<string, unknown>[]
  departments: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  canManage: boolean
}

export function StaffProfileClient({ staff, history, assessments, certs, departments, branches, canManage }: Props) {
  const [tab, setTab] = useState<'profile' | 'history' | 'assessments' | 'certs' | 'transfer'>('profile')
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [archiveReason, setArchiveReason] = useState('')
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showResetModal, setShowResetModal] = useState(false)

  const s = staff as {
    id: string; full_name: string; email: string; job_title?: string; role: UserRole
    status: string; phone?: string; employee_id?: string; nursing_license?: string
    license_expiry?: string; hired_date?: string; department?: unknown; branch?: unknown; unit?: unknown
    department_id?: string; branch_id?: string; unit_id?: string
    created_at: string; last_login_at?: string; archived_at?: string; termination_reason?: string
  }

  const [form, setForm] = useState({
    full_name: s.full_name, job_title: s.job_title ?? '', phone: s.phone ?? '',
    employee_id: s.employee_id ?? '', nursing_license: s.nursing_license ?? '',
    license_expiry: s.license_expiry ?? '', hired_date: s.hired_date ?? '',
    role: s.role, department_id: idOf(s.department) || s.department_id || '',
    branch_id: idOf(s.branch) || s.branch_id || '', unit_id: idOf(s.unit) || s.unit_id || '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // Transfer form state
  const [tForm, setTForm] = useState({ to_department_id: '', to_branch_id: '', to_hospital_id: '', reason: '', effective_date: '' })
  const setT = (k: keyof typeof tForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setTForm((f) => ({ ...f, [k]: e.target.value }))

  function handleSave() {
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)))
    startTransition(async () => {
      const r = await editUser(s.id, fd)
      if (r.success) { toast.success('Profile updated'); setEditing(false) }
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleArchive() {
    if (!archiveReason.trim()) { toast.error('Reason required'); return }
    startTransition(async () => {
      const r = await archiveUser(s.id, archiveReason)
      if (r.success) { toast.success('User archived'); setShowArchiveModal(false) }
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleRestore() {
    startTransition(async () => {
      const r = await restoreUser(s.id)
      if (r.success) toast.success('User restored')
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleResetPassword() {
    if (newPassword.length < 8) { toast.error('Min 8 characters'); return }
    startTransition(async () => {
      const r = await adminResetPassword(s.id, newPassword)
      if (r.success) { toast.success('Password reset'); setShowResetModal(false); setNewPassword('') }
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleTransfer() {
    if (!tForm.reason.trim()) { toast.error('Reason required'); return }
    const fd = new FormData()
    fd.set('staff_id', s.id)
    Object.entries(tForm).forEach(([k, v]) => { if (v) fd.set(k, v) })
    startTransition(async () => {
      const r = await requestTransfer(fd)
      if (r.success) { toast.success('Transfer requested'); setTForm({ to_department_id: '', to_branch_id: '', to_hospital_id: '', reason: '', effective_date: '' }) }
      else toast.error(r.error ?? 'Failed')
    })
  }

  // License expiry alert
  const licenseAlert = (() => {
    if (!s.license_expiry) return null
    const days = Math.ceil((new Date(s.license_expiry).getTime() - Date.now()) / 86400000)
    if (days < 0)  return { msg: `License expired ${Math.abs(days)} days ago`, cls: 'alert-danger' }
    if (days <= 30) return { msg: `License expires in ${days} days`, cls: 'alert-danger' }
    if (days <= 60) return { msg: `License expires in ${days} days`, cls: 'alert-warning' }
    return null
  })()

  return (
    <>
      {/* Header card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div className={`staff-avatar ${getAvatarColor(s.full_name)}`} style={{ width: 64, height: 64, fontSize: 24, flexShrink: 0 }}>
            {getInitials(s.full_name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--navy)' }}>{s.full_name}</div>
            <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>{s.email}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-blue">{getRoleLabel(s.role)}</span>
              <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-gray'}`}>{s.status}</span>
              {!!s.department && <span className="badge badge-teal">{nameOf(s.department)}</span>}
              {!!s.branch && nameOf(s.branch) !== '—' && <span className="badge badge-purple">{nameOf(s.branch)}</span>}
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {s.status !== 'inactive'
                ? <button className="btn btn-danger btn-sm" onClick={() => setShowArchiveModal(true)}>Archive</button>
                : <button className="btn btn-secondary btn-sm" onClick={handleRestore} disabled={isPending}>Restore</button>
              }
              <button className="btn btn-secondary btn-sm" onClick={() => setShowResetModal(true)}>🔑 Reset Password</button>
            </div>
          )}
        </div>
      </div>

      {licenseAlert && (
        <div className={`alert ${licenseAlert.cls}`} style={{ marginBottom: 16 }}>
          ⚠️ {licenseAlert.msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid var(--gray-200)', flexWrap: 'wrap' }}>
        {(['profile', 'history', 'assessments', 'certs', 'transfer'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: tab === t ? 'var(--blue)' : 'var(--gray-500)',
              borderBottom: tab === t ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {{ profile: 'Profile', history: 'History', assessments: 'Assessments', certs: 'Certificates', transfer: 'Transfer' }[t]}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Profile Details</div>
            {canManage && !editing && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
            )}
            {editing && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
          <div className="card-body">
            <div className="grid-2">
              {[
                { label: 'Full Name', key: 'full_name' as const, type: 'text' },
                { label: 'Job Title', key: 'job_title' as const, type: 'text' },
                { label: 'Phone', key: 'phone' as const, type: 'tel' },
                { label: 'Employee ID', key: 'employee_id' as const, type: 'text' },
                { label: 'Nursing License', key: 'nursing_license' as const, type: 'text' },
                { label: 'License Expiry', key: 'license_expiry' as const, type: 'date' },
                { label: 'Hired Date', key: 'hired_date' as const, type: 'date' },
              ].map(({ label, key, type }) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  {editing
                    ? <input type={type} className="form-control" value={form[key]} onChange={set(key)} />
                    : <div style={{ padding: '8px 0', fontSize: 14 }}>{String(form[key] || '—')}</div>
                  }
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Role</label>
                {editing
                  ? <select className="form-control" value={form.role} onChange={set('role')}>
                      {ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                    </select>
                  : <div style={{ padding: '8px 0', fontSize: 14 }}>{getRoleLabel(form.role)}</div>
                }
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                {editing
                  ? <select className="form-control" value={form.department_id} onChange={set('department_id')}>
                      <option value="">None</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  : <div style={{ padding: '8px 0', fontSize: 14 }}>{nameOf(s.department)}</div>
                }
              </div>
              <div className="form-group">
                <label className="form-label">Branch</label>
                {editing
                  ? <select className="form-control" value={form.branch_id} onChange={set('branch_id')}>
                      <option value="">None</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  : <div style={{ padding: '8px 0', fontSize: 14 }}>{nameOf(s.branch)}</div>
                }
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
              <div className="form-group">
                <label className="form-label text-muted">Email</label>
                <div style={{ fontSize: 14 }}>{s.email}</div>
              </div>
              <div className="form-group">
                <label className="form-label text-muted">Last Login</label>
                <div style={{ fontSize: 14 }}>{s.last_login_at ? new Date(s.last_login_at).toLocaleString() : '—'}</div>
              </div>
              <div className="form-group">
                <label className="form-label text-muted">Created</label>
                <div style={{ fontSize: 14 }}>{new Date(s.created_at).toLocaleDateString()}</div>
              </div>
              {s.archived_at && (
                <div className="form-group">
                  <label className="form-label text-muted">Archived</label>
                  <div style={{ fontSize: 14, color: 'var(--red)' }}>{new Date(s.archived_at).toLocaleDateString()} — {s.termination_reason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Profile Change History</div></div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="text-sm text-muted">{new Date(h.changed_at).toLocaleString()}</td>
                      <td className="text-sm" style={{ textTransform: 'capitalize' }}>{h.field_name.replace(/_/g, ' ')}</td>
                      <td className="text-sm text-muted">{h.old_value ?? '—'}</td>
                      <td className="text-sm">{h.new_value ?? '—'}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No changes recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Assessments tab */}
      {tab === 'assessments' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Assessments</div>
            <Link href={`/assessments/new?staff_id=${s.id}`} className="btn btn-primary btn-sm">＋ New Assessment</Link>
          </div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Competency</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {assessments.map((a) => {
                    const tpl = Array.isArray(a.template) ? a.template[0] : a.template as { title?: string } | null
                    return (
                      <tr key={String(a.id)}>
                        <td style={{ fontWeight: 500 }}>{tpl?.title ?? '—'}</td>
                        <td><span className={`badge ${ASSESS_BADGE[String(a.status)] ?? 'badge-gray'}`}>{String(a.status).replace(/_/g, ' ')}</span></td>
                        <td className="text-sm text-muted">{new Date(String(a.created_at)).toLocaleDateString()}</td>
                      </tr>
                    )
                  })}
                  {assessments.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No assessments</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Certificates tab */}
      {tab === 'certs' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Certificates</div></div>
          <div className="card-body p-0">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Certificate #</th><th>Competency</th><th>Issued</th><th>Expires</th><th>Status</th></tr></thead>
                <tbody>
                  {certs.map((c) => {
                    const tpl = Array.isArray(c.template) ? c.template[0] : c.template as { title?: string } | null
                    return (
                      <tr key={String(c.id)}>
                        <td className="text-sm" style={{ fontFamily: 'monospace' }}>{String(c.certificate_number)}</td>
                        <td style={{ fontWeight: 500 }}>{tpl?.title ?? '—'}</td>
                        <td className="text-sm text-muted">{String(c.issued_date)}</td>
                        <td className="text-sm text-muted">{String(c.expiry_date)}</td>
                        <td><span className={`badge ${CERT_BADGE[String(c.status)] ?? 'badge-gray'}`}>{String(c.status).replace(/_/g, ' ')}</span></td>
                      </tr>
                    )
                  })}
                  {certs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No certificates</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transfer tab */}
      {tab === 'transfer' && canManage && (
        <div className="card">
          <div className="card-header"><div className="card-title">Request Transfer</div></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Transfer to Department</label>
                <select className="form-control" value={tForm.to_department_id} onChange={setT('to_department_id')}>
                  <option value="">Keep current</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transfer to Branch</label>
                <select className="form-control" value={tForm.to_branch_id} onChange={setT('to_branch_id')}>
                  <option value="">Keep current</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Effective Date</label>
                <input type="date" className="form-control" value={tForm.effective_date} onChange={setT('effective_date')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea className="form-control" rows={3} value={tForm.reason} onChange={(e) => setTForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason for transfer…" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleTransfer} disabled={isPending || !tForm.reason.trim()}>
                {isPending ? 'Submitting…' : 'Submit Transfer Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive modal */}
      {showArchiveModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Archive {s.full_name}</h3>
              <button className="modal-close" onClick={() => setShowArchiveModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 12 }}>
                This deactivates the account and blocks login. Record is retained for compliance.
              </p>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-control" rows={3} value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Termination reason…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowArchiveModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleArchive} disabled={isPending || !archiveReason.trim()}>
                {isPending ? 'Archiving…' : 'Archive User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {showResetModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="modal-close" onClick={() => setShowResetModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input type="password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} placeholder="Min 8 characters" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={isPending || newPassword.length < 8}>
                {isPending ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
