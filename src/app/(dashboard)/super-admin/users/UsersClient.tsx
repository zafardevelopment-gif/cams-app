'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { getRoleLabel, getRoleBadgeColor, getInitials } from '@/lib/utils'
import { deleteUserAccount } from '@/actions/users'

interface UserRow {
  id: string
  full_name: string
  email: string
  role: string
  status: string
  job_title: string | null
  created_at: string
  hospital: { name: string } | { name: string }[] | null
}

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green',
  inactive: 'badge-gray',
  suspended: 'badge-red',
  pending: 'badge-yellow',
}

export default function UsersClient({ users, hospitals }: {
  users: UserRow[]
  hospitals: { id: string; name: string }[]
}) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterHospital, setFilterHospital] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const r = await deleteUserAccount(deleteTarget.id)
      if (r.success) {
        toast.success(`${deleteTarget.full_name} deleted`)
        setDeleteTarget(null)
        window.location.reload()
      } else {
        toast.error(r.error ?? 'Failed to delete')
        setDeleteTarget(null)
      }
    })
  }

  const filtered = users.filter((u) => {
    const hospitalName = u.hospital
      ? (Array.isArray(u.hospital) ? u.hospital[0]?.name : u.hospital.name) ?? ''
      : ''
    const matchSearch = !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      hospitalName.toLowerCase().includes(search.toLowerCase())
    const matchRole = !filterRole || u.role === filterRole
    const matchStatus = !filterStatus || u.status === filterStatus
    const matchHospital = !filterHospital || hospitalName === (hospitals.find((h) => h.id === filterHospital)?.name ?? '')
    return matchSearch && matchRole && matchStatus && matchHospital
  })

  const roles = ['hospital_admin', 'branch_admin', 'department_head', 'unit_head', 'head_nurse', 'hr_quality', 'assessor', 'educator', 'staff', 'auditor']

  return (
    <>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              placeholder="Name, email, or hospital…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label className="form-label">Role</label>
            <select className="form-input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div style={{ flex: '0 1 200px' }}>
            <label className="form-label">Hospital</label>
            <select className="form-input" value={filterHospital} onChange={(e) => setFilterHospital(e.target.value)}>
              <option value="">All Hospitals</option>
              {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          {(search || filterRole || filterStatus || filterHospital) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); setFilterHospital('') }}
            >
              Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)', alignSelf: 'center' }}>
            {filtered.length} of {users.length} users
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Hospital</th>
                  <th>Role</th>
                  <th>Job Title</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const hospitalName = u.hospital
                    ? (Array.isArray(u.hospital) ? u.hospital[0]?.name : u.hospital.name) ?? '—'
                    : '—'
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div
                            className="staff-avatar"
                            style={{ background: `linear-gradient(135deg, ${getRoleBadgeColor(u.role)}, #90A4AE)` }}
                          >
                            {getInitials(u.full_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{hospitalName}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 600, color: 'white',
                            background: getRoleBadgeColor(u.role),
                          }}
                        >
                          {getRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{u.job_title ?? '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[u.status] ?? 'badge-gray'}`}>
                          {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                        </span>
                      </td>
                      <td className="text-sm text-muted">
                        {new Date(u.created_at).toLocaleDateString('en-CA')}
                      </td>
                      <td>
                        {u.role !== 'super_admin' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget(u)}
                            title="Delete user"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>
                      {users.length === 0 ? 'No users yet' : 'No results match your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 420 }}>
            <h3 style={{ marginBottom: 10, color: 'var(--red)' }}>Delete User?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 6 }}>
              You are about to permanently delete:
            </p>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>{deleteTarget.full_name}</p>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 16 }}>{deleteTarget.email}</p>
            <p style={{ fontSize: 12, color: 'var(--red)', background: '#FFEBEE', padding: '8px 12px', borderRadius: 6, marginBottom: 20 }}>
              This removes the user profile and auth account permanently. All their assessment records will remain but will be unlinked.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" disabled={isPending} onClick={handleDelete}>
                {isPending ? 'Deleting…' : 'Delete Permanently'}
              </button>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
