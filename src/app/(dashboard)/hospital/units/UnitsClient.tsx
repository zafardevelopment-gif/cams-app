'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createUnit, updateUnit, toggleUnitStatus } from '@/actions/branches'
import type { Unit, Department, Branch } from '@/types'

interface Props {
  units: Unit[]
  departments: Pick<Department, 'id' | 'name'>[]
  branches: Pick<Branch, 'id' | 'name'>[]
}

const EMPTY_FORM = { name: '', name_ar: '', department_id: '', branch_id: '', head_user_id: '' }

export function UnitsClient({ units: initial, departments, branches }: Props) {
  const [units, setUnits] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(u: Unit) {
    setEditing(u)
    const deptRaw = u.department as unknown
    const branchRaw = u.branch as unknown
    const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw as { id: string } | null
    const branch = Array.isArray(branchRaw) ? branchRaw[0] : branchRaw as { id: string } | null
    setForm({
      name: u.name,
      name_ar: u.name_ar ?? '',
      department_id: dept?.id ?? u.department_id,
      branch_id: branch?.id ?? u.branch_id ?? '',
      head_user_id: u.head_user_id ?? '',
    })
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))

    startTransition(async () => {
      const result = editing ? await updateUnit(editing.id, fd) : await createUnit(fd)
      if (result.success) {
        toast.success(editing ? 'Unit updated' : 'Unit created')
        setShowForm(false)
        window.location.reload()
      } else {
        toast.error(result.error ?? 'Failed')
      }
    })
  }

  function handleToggle(u: Unit) {
    startTransition(async () => {
      const result = await toggleUnitStatus(u.id, !u.is_active)
      if (result.success) {
        setUnits((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: !u.is_active } : x))
        toast.success(u.is_active ? 'Unit deactivated' : 'Unit activated')
      } else {
        toast.error(result.error ?? 'Failed')
      }
    })
  }

  const nameOf = (raw: unknown) => {
    const obj = Array.isArray(raw) ? raw[0] : raw as { name: string } | null
    return obj?.name ?? '—'
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All Units</div>
            <div className="card-subtitle">{units.length} unit{units.length !== 1 ? 's' : ''}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Add Unit</button>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Department</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      {u.name_ar && <div className="text-xs text-muted">{u.name_ar}</div>}
                    </td>
                    <td className="text-sm">{nameOf(u.department)}</td>
                    <td className="text-sm">{u.branch_id ? nameOf(u.branch) : <span className="text-muted">—</span>}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleToggle(u)}
                          disabled={isPending}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {units.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                      No units yet. Click "Add Unit" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Unit' : 'Add Unit'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Unit Name (EN) *</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Name (AR)</label>
                    <input
                      className="form-control"
                      value={form.name_ar}
                      onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="form-control"
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Branch (optional)</label>
                  <select
                    className="form-control"
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  >
                    <option value="">No branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
