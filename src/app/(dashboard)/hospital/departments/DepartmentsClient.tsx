'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateDepartment } from '@/actions/branches'
import type { Department, Branch } from '@/types'

interface Props {
  departments: Department[]
  branches: Pick<Branch, 'id' | 'name'>[]
}

export function DepartmentsClient({ departments: initial, branches }: Props) {
  const [departments, setDepartments] = useState(initial)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ name: '', name_ar: '', branch_id: '', head_nurse_id: '' })
  const [isPending, startTransition] = useTransition()

  function openEdit(d: Department) {
    setEditing(d)
    const branchRaw = d.branch as unknown
    const branch = Array.isArray(branchRaw) ? branchRaw[0] : branchRaw as { id: string } | null
    setForm({
      name: d.name,
      name_ar: d.name_ar ?? '',
      branch_id: branch?.id ?? d.branch_id ?? '',
      head_nurse_id: d.head_nurse_id ?? '',
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))

    startTransition(async () => {
      const result = await updateDepartment(editing.id, fd)
      if (result.success) {
        toast.success('Department updated')
        const branchPick = branches.find((b) => b.id === form.branch_id) ?? null
        setDepartments((prev) =>
          prev.map((d) =>
            d.id === editing.id
              ? { ...d, name: form.name, name_ar: form.name_ar || undefined, branch_id: form.branch_id || undefined, branch: branchPick as Branch | undefined }
              : d
          )
        )
        setEditing(null)
      } else {
        toast.error(result.error ?? 'Failed')
      }
    })
  }

  const branchName = (d: Department) => {
    const branchRaw = d.branch as unknown
    const branch = Array.isArray(branchRaw) ? branchRaw[0] : branchRaw as { name: string } | null
    return branch?.name ?? (d.branch_id ? '—' : 'Unassigned')
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All Departments</div>
            <div className="card-subtitle">{departments.length} department{departments.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      {d.name_ar && <div className="text-xs text-muted">{d.name_ar}</div>}
                    </td>
                    <td>
                      {d.branch_id
                        ? <span className="badge badge-blue">{branchName(d)}</span>
                        : <span className="text-sm text-muted">Unassigned</span>
                      }
                    </td>
                    <td>
                      <span className={`badge ${d.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(d)}>Edit</button>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                      No departments found for this hospital.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Edit Department</h3>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Name (EN) *</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name (AR)</label>
                    <input
                      className="form-control"
                      value={form.name_ar}
                      onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Assign to Branch</label>
                  <select
                    className="form-control"
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  >
                    <option value="">No branch (unassigned)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
