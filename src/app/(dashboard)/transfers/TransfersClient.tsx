'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { processTransfer } from '@/actions/staff'
import { getInitials } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red', completed: 'badge-blue',
}

function nameOf(raw: unknown) {
  const obj = Array.isArray(raw) ? raw[0] : raw as { name?: string } | null
  return obj?.name ?? '—'
}

interface TransferRow {
  id: string; status: string; head_nurse_approval: string; admin_approval: string
  reason?: string; effective_date?: string; notes?: string; created_at: string
  staff: unknown; from_hospital: unknown; to_hospital: unknown; from_dept: unknown; to_dept: unknown
}

interface Props {
  transfers: TransferRow[]
  callerRole: string
  canApprove: boolean
}

export function TransfersClient({ transfers, callerRole, canApprove }: Props) {
  const [isPending, startTransition] = useTransition()
  const [reviewTarget, setReviewTarget] = useState<TransferRow | null>(null)
  const [notes, setNotes] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = filterStatus ? transfers.filter((t) => t.status === filterStatus) : transfers
  const pendingCount = transfers.filter((t) => t.status === 'pending').length

  function handleProcess(action: 'approved' | 'rejected') {
    if (!reviewTarget) return
    startTransition(async () => {
      const r = await processTransfer(reviewTarget.id, action, notes)
      if (r.success) {
        toast.success(`Transfer ${action}`)
        setReviewTarget(null)
        setNotes('')
        window.location.reload()
      } else {
        toast.error(r.error ?? 'Failed')
      }
    })
  }

  const isAdminRole = ['super_admin', 'hospital_admin', 'branch_admin'].includes(callerRole)
  const isNurseRole = ['head_nurse', 'department_head', 'unit_head'].includes(callerRole)

  function canProcess(t: TransferRow) {
    if (!canApprove) return false
    if (isNurseRole && t.head_nurse_approval === 'pending') return true
    if (isAdminRole && t.head_nurse_approval === 'approved' && t.admin_approval === 'pending') return true
    return false
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Staff Transfers</h1>
          <p>{pendingCount} pending transfer{pendingCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="filter-row" style={{ marginBottom: 16 }}>
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Head Nurse</th>
                  <th>Admin</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const staff = (Array.isArray(t.staff) ? t.staff[0] : t.staff) as { full_name?: string; job_title?: string } | null
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg,var(--blue),var(--teal))' }}>
                            {getInitials(staff?.full_name ?? '?')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{staff?.full_name ?? '—'}</div>
                            <div className="text-xs text-muted">{staff?.job_title ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm">
                        <div>{nameOf(t.from_hospital)}</div>
                        {nameOf(t.from_dept) !== '—' && <div className="text-xs text-muted">{nameOf(t.from_dept)}</div>}
                      </td>
                      <td className="text-sm">
                        <div>{nameOf(t.to_hospital)}</div>
                        {nameOf(t.to_dept) !== '—' && <div className="text-xs text-muted">{nameOf(t.to_dept)}</div>}
                      </td>
                      <td className="text-sm text-muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.reason ?? '—'}
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[t.head_nurse_approval] ?? 'badge-gray'}`}>{t.head_nurse_approval}</span></td>
                      <td><span className={`badge ${STATUS_BADGE[t.admin_approval] ?? 'badge-gray'}`}>{t.admin_approval}</span></td>
                      <td><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>{t.status}</span></td>
                      <td className="text-sm text-muted">{new Date(t.created_at).toLocaleDateString('en-CA')}</td>
                      <td>
                        {canProcess(t) && (
                          <button className="btn btn-primary btn-sm" onClick={() => { setReviewTarget(t); setNotes('') }}>
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No transfer requests</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review modal */}
      {reviewTarget && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Review Transfer</h3>
              <button className="modal-close" onClick={() => setReviewTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              {(() => {
                const staff = (Array.isArray(reviewTarget.staff) ? reviewTarget.staff[0] : reviewTarget.staff) as { full_name?: string } | null
                return (
                  <div style={{ marginBottom: 12, padding: 12, background: 'var(--gray-50)', borderRadius: 6 }}>
                    <div style={{ fontWeight: 600 }}>{staff?.full_name}</div>
                    <div className="text-sm text-muted">{nameOf(reviewTarget.from_hospital)} → {nameOf(reviewTarget.to_hospital)}</div>
                    <div className="text-sm" style={{ marginTop: 4 }}>Reason: {reviewTarget.reason}</div>
                    {reviewTarget.effective_date && <div className="text-sm text-muted">Effective: {reviewTarget.effective_date}</div>}
                  </div>
                )
              })()}
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any comments or conditions…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setReviewTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleProcess('rejected')} disabled={isPending}>
                {isPending ? '…' : 'Reject'}
              </button>
              <button className="btn btn-success" onClick={() => handleProcess('approved')} disabled={isPending}>
                {isPending ? '…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
