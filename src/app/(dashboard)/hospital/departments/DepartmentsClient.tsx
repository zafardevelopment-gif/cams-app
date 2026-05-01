'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createDepartment, updateDepartment, deleteDepartment } from '@/actions/branches'
import type { Department, Branch } from '@/types'

interface Props {
  departments: Department[]
  branches: Pick<Branch, 'id' | 'name'>[]
  hasBranches: boolean
}

const EMPTY_FORM = { name: '', name_ar: '', branch_id: '', head_nurse_id: '' }

export function DepartmentsClient({ departments: initial, branches, hasBranches }: Props) {
  const [departments, setDepartments] = useState(initial)
  const [editing, setEditing] = useState<Department | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  function openAdd() {
    setForm(EMPTY_FORM)
    setAdding(true)
    setEditing(null)
  }

  function openEdit(d: Department) {
    const branchRaw = d.branch as unknown
    const branch = Array.isArray(branchRaw) ? branchRaw[0] : branchRaw as { id: string } | null
    setForm({
      name:          d.name,
      name_ar:       d.name_ar ?? '',
      branch_id:     branch?.id ?? d.branch_id ?? '',
      head_nurse_id: d.head_nurse_id ?? '',
    })
    setEditing(d)
    setAdding(false)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))

    startTransition(async () => {
      const result = await createDepartment(fd)
      if (result.success && result.data) {
        toast.success('Department created')
        const branchPick = branches.find((b) => b.id === form.branch_id) ?? null
        const newDept: Department = {
          id:            result.data.id,
          hospital_id:   '',
          name:          form.name,
          name_ar:       form.name_ar || undefined,
          branch_id:     form.branch_id || undefined,
          branch:        branchPick as Branch | undefined,
          head_nurse_id: form.head_nurse_id || undefined,
          is_active:     true,
          created_at:    new Date().toISOString(),
        }
        setDepartments((prev) => [...prev, newDept].sort((a, b) => a.name.localeCompare(b.name)))
        setAdding(false)
      } else {
        toast.error(result.error ?? 'Failed')
      }
    })
  }

  function handleEdit(e: React.FormEvent) {
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

  function handleDelete() {
    if (!confirmDelete) return
    startTransition(async () => {
      const result = await deleteDepartment(confirmDelete.id)
      if (result.success) {
        toast.success('Department removed')
        setDepartments((prev) => prev.filter((d) => d.id !== confirmDelete.id))
        setConfirmDelete(null)
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

  const modalOpen = adding || !!editing

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All Departments</div>
            <div className="card-subtitle">
              {departments.length} department{departments.length !== 1 ? 's' : ''}
              {hasBranches ? ' · Edit a department to assign it to a branch' : ''}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>＋ Add Department</button>
        </div>
        <div className="card-body p-0">
          {departments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏬</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No departments yet</div>
              <div style={{ fontSize: '0.85rem' }}>Click &ldquo;Add Department&rdquo; to create your first one.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Department Name</th>
                    {hasBranches && <th>Branch</th>}
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
                      {hasBranches && (
                        <td>
                          {d.branch_id
                            ? <span className="badge badge-blue">{branchName(d)}</span>
                            : <span className="text-sm text-muted">Unassigned</span>
                          }
                        </td>
                      )}
                      <td>
                        <span className={`badge ${d.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(d)}>Edit</button>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2' }}
                          onClick={() => setConfirmDelete(d)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{adding ? 'Add Department' : 'Edit Department'}</h3>
              <button className="modal-close" onClick={() => { setAdding(false); setEditing(null) }}>✕</button>
            </div>
            <form onSubmit={adding ? handleAdd : handleEdit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Department Name (English) *</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Intensive Care Unit"
                      value={form.name}
                      onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name: v })) }}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department Name (Arabic)</label>
                    <input
                      className="form-control"
                      placeholder="اسم القسم بالعربي"
                      value={form.name_ar}
                      onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name_ar: v })) }}
                      dir="rtl"
                    />
                  </div>
                </div>
                {hasBranches && (
                  <div className="form-group">
                    <label className="form-label">Assign to Branch</label>
                    {branches.length === 0 ? (
                      <div style={{ padding: '10px 12px', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 6, fontSize: '0.85rem', color: '#795548' }}>
                        ⚠️ No branches created yet. <a href="/hospital/branches" style={{ color: 'var(--blue)' }}>Create a branch first</a> before assigning departments.
                      </div>
                    ) : (
                      <select
                        className="form-control"
                        value={form.branch_id}
                        onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, branch_id: v })) }}
                      >
                        <option value="">— Select a branch (optional) —</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setAdding(false); setEditing(null) }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Saving…' : (adding ? 'Create Department' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Delete Department</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>
                Are you sure you want to remove <strong>{confirmDelete.name}</strong>? This will deactivate the department. Staff currently in this department will not be affected.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#C62828', borderColor: '#C62828' }}
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? 'Deleting…' : 'Delete Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
