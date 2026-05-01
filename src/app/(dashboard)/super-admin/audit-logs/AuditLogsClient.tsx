'use client'

import { useState } from 'react'

interface LogRow {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  description: string | null
  created_at: string
  user: { full_name: string; email: string; role: string } | null
}

const ACTION_BADGE: Record<string, string> = {
  user_login: 'badge-blue',
  user_logout: 'badge-gray',
  create_assessment: 'badge-green',
  submit_assessment: 'badge-purple',
  approve_approval: 'badge-green',
  reject_approval: 'badge-red',
  issue_certificate: 'badge-green',
  approve_registration: 'badge-green',
  reject_registration: 'badge-red',
  update_profile: 'badge-blue',
  password_changed: 'badge-yellow',
  bulk_import_users: 'badge-teal',
  delete_hospital: 'badge-red',
  delete_user: 'badge-red',
  update_email_config: 'badge-yellow',
}

export default function AuditLogsClient({ logs }: { logs: LogRow[] }) {
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')

  const actions = Array.from(new Set(logs.map((l) => l.action))).sort()

  const filtered = logs.filter((l) => {
    const matchSearch = !search ||
      (l.user?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.user?.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase())
    const matchAction = !filterAction || l.action === filterAction
    return matchSearch && matchAction
  })

  return (
    <>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              placeholder="User, description, action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label className="form-label">Action</label>
            <select className="form-input" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          {(search || filterAction) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterAction('') }}>
              Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)', alignSelf: 'center' }}>
            {filtered.length} of {logs.length} entries
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--gray-500)' }}>
                      {new Date(log.created_at).toLocaleDateString('en-CA')}{' '}
                      <span style={{ color: 'var(--gray-400)' }}>
                        {new Date(log.created_at).toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      {log.user ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{log.user.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{log.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-muted text-sm">System</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${ACTION_BADGE[log.action] ?? 'badge-gray'}`} style={{ whiteSpace: 'nowrap' }}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.description ?? '—'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                      {log.entity_type ? (
                        <span>{log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}…` : ''}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>
                      No audit log entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
