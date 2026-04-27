'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getInitials, getAvatarColor, getRoleLabel } from '@/lib/utils'
import { archiveUser, restoreUser, createUser, adminResetPassword } from '@/actions/staff'
import { BulkImportModal } from './BulkImportModal'
import { CreateUserModal } from './CreateUserModal'
import type { UserRole } from '@/types'

interface StaffRow {
  id: string; full_name: string; email: string; job_title?: string | null
  role: string; employee_id?: string | null; nursing_license?: string | null
  license_expiry?: string | null; hired_date?: string | null; status: string
  created_at: string; department?: unknown; branch?: unknown
  hospital_id?: string | null; archived_at?: string | null
}

interface Props {
  staff: StaffRow[]
  departments: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  callerRole: string
  callerHospitalId: string
  canManage: boolean
  expiringCount: number
  expiredCount: number
}

const PAGE_SIZE = 25
const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', pending: 'badge-yellow', inactive: 'badge-gray', suspended: 'badge-red',
}

function licenseStatus(exp?: string | null) {
  if (!exp) return null
  const days = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000)
  if (days < 0)  return { label: 'Expired', cls: 'badge-red' }
  if (days <= 30) return { label: `${days}d left`, cls: 'badge-red' }
  if (days <= 60) return { label: `${days}d left`, cls: 'badge-amber' }
  return { label: new Date(exp).toLocaleDateString(), cls: 'badge-gray' }
}

function nameOf(raw: unknown): string {
  const obj = Array.isArray(raw) ? raw[0] : raw as { name: string } | null
  return obj?.name ?? '—'
}

export function StaffDirectoryClient({
  staff: allStaff, departments, branches, callerRole, callerHospitalId, canManage, expiringCount, expiredCount,
}: Props) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [archiveTarget, setArchiveTarget] = useState<StaffRow | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allStaff.filter((s) => {
      if (!showArchived && s.status === 'inactive') return false
      if (filterRole   && s.role !== filterRole) return false
      if (filterStatus && s.status !== filterStatus) return false
      if (filterDept) {
        const deptRaw = s.department as unknown
        const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw as { id?: string } | null
        if ((dept as { id?: string } | null)?.id !== filterDept) return false
      }
      if (filterBranch) {
        const branchRaw = s.branch as unknown
        const branch = Array.isArray(branchRaw) ? branchRaw[0] : branchRaw as { id?: string } | null
        if ((branch as { id?: string } | null)?.id !== filterBranch) return false
      }
      if (q) {
        const haystack = `${s.full_name} ${s.email} ${s.employee_id ?? ''} ${s.nursing_license ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allStaff, search, filterRole, filterStatus, filterDept, filterBranch, showArchived])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSlice  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetFilters() {
    setSearch(''); setFilterRole(''); setFilterStatus(''); setFilterDept(''); setFilterBranch('')
    setPage(1)
  }

  function handleArchive() {
    if (!archiveTarget || !archiveReason.trim()) { toast.error('Reason required'); return }
    startTransition(async () => {
      const r = await archiveUser(archiveTarget.id, archiveReason)
      if (r.success) { toast.success('User archived'); setArchiveTarget(null); setArchiveReason('') }
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleRestore(userId: string) {
    startTransition(async () => {
      const r = await restoreUser(userId)
      if (r.success) toast.success('User restored')
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleResetPassword() {
    if (!resetTarget || newPassword.length < 8) { toast.error('Min 8 characters'); return }
    startTransition(async () => {
      const r = await adminResetPassword(resetTarget.id, newPassword)
      if (r.success) { toast.success('Password reset'); setResetTarget(null); setNewPassword('') }
      else toast.error(r.error ?? 'Failed')
    })
  }

  const activeCount   = allStaff.filter((s) => s.status === 'active').length
  const pendingCount  = allStaff.filter((s) => s.status === 'pending').length
  const archivedCount = allStaff.filter((s) => s.status === 'inactive').length

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Staff Directory</h1>
          <p>{allStaff.length} total staff members</p>
        </div>
        {canManage && (
          <div className="page-header-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowBulk(true)}>📥 Bulk Import</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>＋ Add Staff</button>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20 }}>
        {[
          { icon: '✅', label: 'Active', value: activeCount, bg: '#E8F5E9' },
          { icon: '⏳', label: 'Pending', value: pendingCount, bg: '#FFF8E1' },
          { icon: '🗃️', label: 'Archived', value: archivedCount, bg: '#FAFAFA' },
          { icon: '⚠️', label: 'License Expiring', value: expiringCount, bg: '#FFF3E0', alert: expiringCount > 0 },
          { icon: '🚨', label: 'License Expired', value: expiredCount, bg: '#FFEBEE', alert: expiredCount > 0 },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            {k.alert && <div className="kpi-change down">Needs attention</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-row" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div className="search-bar" style={{ width: 260 }}>
          <span>🔍</span>
          <input
            placeholder="Search name, email, ID, license…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="filter-select" value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}>
          <option value="">All Roles</option>
          {['staff','assessor','educator','head_nurse','unit_head','department_head','hr_quality','branch_admin','hospital_admin','auditor'].map((r) => (
            <option key={r} value={r}>{getRoleLabel(r)}</option>
          ))}
        </select>
        <select className="filter-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        {departments.length > 0 && (
          <select className="filter-select" value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(1) }}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {branches.length > 0 && (
          <select className="filter-select" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setPage(1) }}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(1) }} />
          Show archived
        </label>
        {(search || filterRole || filterStatus || filterDept || filterBranch) && (
          <button className="btn btn-secondary btn-sm" onClick={resetFilters}>✕ Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            Page {page} of {totalPages}
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Department / Branch</th>
                  <th>Employee ID</th>
                  <th>License</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((s) => {
                  const lic = licenseStatus(s.license_expiry)
                  return (
                    <tr key={s.id} style={s.status === 'inactive' ? { opacity: 0.6 } : undefined}>
                      <td>
                        <div className="staff-name-cell">
                          <div className={`staff-avatar ${getAvatarColor(s.full_name)}`}>
                            {getInitials(s.full_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{s.full_name}</div>
                            <div className="text-xs text-muted">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-blue">{getRoleLabel(s.role)}</span></td>
                      <td className="text-sm">
                        <div>{nameOf(s.department)}</div>
                        {!!s.branch && nameOf(s.branch) !== '—' && (
                          <div className="text-xs text-muted">{nameOf(s.branch)}</div>
                        )}
                      </td>
                      <td className="text-sm text-muted">{s.employee_id ?? '—'}</td>
                      <td>
                        {lic
                          ? <span className={`badge ${lic.cls}`}>{lic.label}</span>
                          : <span className="text-sm text-muted">—</span>
                        }
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-gray'}`}>{s.status}</span></td>
                      <td className="text-sm text-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Link href={`/staff-directory/${s.id}`} className="btn btn-secondary btn-sm">View</Link>
                          {canManage && s.status !== 'inactive' && (
                            <button className="btn btn-danger btn-sm" onClick={() => { setArchiveTarget(s); setArchiveReason('') }} disabled={isPending}>
                              Archive
                            </button>
                          )}
                          {canManage && s.status === 'inactive' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(s.id)} disabled={isPending}>
                              Restore
                            </button>
                          )}
                          {canManage && (
                            <button className="btn btn-secondary btn-sm" onClick={() => { setResetTarget(s); setNewPassword('') }}>
                              🔑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {pageSlice.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No staff found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3
              if (pg < 1 || pg > totalPages) return null
              return (
                <button key={pg} className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(pg)}>
                  {pg}
                </button>
              )
            })}
            <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
          </div>
        )}
      </div>

      {/* Archive modal */}
      {archiveTarget && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Archive {archiveTarget.full_name}</h3>
              <button className="modal-close" onClick={() => setArchiveTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 12 }}>
                This will deactivate the account and block login. The record is kept for compliance.
              </p>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-control" rows={3} value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Termination reason, resignation, contract end…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setArchiveTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleArchive} disabled={isPending || !archiveReason.trim()}>
                {isPending ? 'Archiving…' : 'Archive User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Reset Password — {resetTarget.full_name}</h3>
              <button className="modal-close" onClick={() => setResetTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input type="password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} placeholder="Min 8 characters" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={isPending || newPassword.length < 8}>
                {isPending ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          departments={departments}
          branches={branches}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showBulk && (
        <BulkImportModal onClose={() => setShowBulk(false)} />
      )}
    </>
  )
}
