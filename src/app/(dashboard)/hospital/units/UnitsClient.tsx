'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createUnit, updateUnit, toggleUnitStatus } from '@/actions/branches'
import type { Unit, Department, Branch } from '@/types'
import { UnitZeroState } from '@/components/onboarding/OnboardingComponents'

interface Props {
  units: Unit[]
  departments: Pick<Department, 'id' | 'name'>[]
  branches: Pick<Branch, 'id' | 'name'>[]
  hasBranches: boolean
}

const EMPTY_FORM = { name: '', name_ar: '', department_id: '', branch_id: '', head_user_id: '' }

export function UnitsClient({ units: initial, departments, branches, hasBranches }: Props) {
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
      if (editing) {
        const result = await updateUnit(editing.id, fd)
        if (result.success) {
          toast.success('Unit updated')
          const deptPick = departments.find((d) => d.id === form.department_id) ?? null
          const branchPick = branches.find((b) => b.id === form.branch_id) ?? null
          setUnits((prev) => prev.map((u) =>
            u.id === editing.id
              ? { ...u, name: form.name, name_ar: form.name_ar || undefined, department_id: form.department_id, branch_id: form.branch_id || undefined, department: deptPick as Department, branch: branchPick as Branch | undefined }
              : u
          ))
          setShowForm(false)
          setEditing(null)
        } else {
          toast.error(result.error ?? 'Failed')
        }
      } else {
        const result = await createUnit(fd)
        if (result.success && result.data) {
          toast.success('Unit created')
          const deptPick = departments.find((d) => d.id === form.department_id) ?? null
          const branchPick = branches.find((b) => b.id === form.branch_id) ?? null
          const now = new Date().toISOString()
          const newUnit: Unit = {
            id:            result.data.id,
            hospital_id:   '',
            department_id: form.department_id,
            branch_id:     form.branch_id || undefined,
            name:          form.name,
            name_ar:       form.name_ar || undefined,
            head_user_id:  form.head_user_id || undefined,
            is_active:     true,
            created_at:    now,
            updated_at:    now,
            department:    deptPick as Department,
            branch:        branchPick as Branch | undefined,
          }
          setUnits((prev) => [...prev, newUnit].sort((a, b) => a.name.localeCompare(b.name)))
          setShowForm(false)
          setForm(EMPTY_FORM)
        } else {
          toast.error(result.error ?? 'Failed')
        }
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

  // Zero state
  if (units.length === 0 && !showForm) {
    return (
      <>
        <UnitZeroState hasDepartments={departments.length > 0} onCreateClick={openCreate} />
        {showForm && renderForm()}
      </>
    )
  }

  function renderForm() {
    return (
      <div className="modal-backdrop">
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h3>{editing ? 'Edit Unit' : 'Add Unit'}</h3>
            <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: 16 }}>
                Units are sub-groups within a department — for example, ICU, Ward A, or Recovery Room.
              </p>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Unit Name (English) *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. ICU Ward"
                    value={form.name}
                    onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name: v })) }}
                    required
                    minLength={2}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Name (Arabic)</label>
                  <input
                    className="form-control"
                    placeholder="اسم الوحدة"
                    value={form.name_ar}
                    onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name_ar: v })) }}
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Department *</label>
                {departments.length === 0 ? (
                  <div style={{ padding: '10px 12px', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 6, fontSize: '0.85rem', color: '#795548' }}>
                    ⚠️ No departments available. <a href="/hospital/departments" style={{ color: 'var(--blue)' }}>Create a department first.</a>
                  </div>
                ) : (
                  <select
                    className="form-control"
                    value={form.department_id}
                    onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, department_id: v })) }}
                    required
                  >
                    <option value="">— Select department —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {hasBranches && (
                <div className="form-group">
                  <label className="form-label">Branch <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optional)</span></label>
                  <select
                    className="form-control"
                    value={form.branch_id}
                    onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, branch_id: v })) }}
                  >
                    <option value="">— No branch —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
    )
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All Units</div>
            <div className="card-subtitle">{units.length} unit{units.length !== 1 ? 's' : ''} · Units are sub-groups within departments</div>
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
                  {hasBranches && <th>Branch</th>}
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
                    {hasBranches && <td className="text-sm">{u.branch_id ? nameOf(u.branch) : <span className="text-muted">—</span>}</td>}
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
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && renderForm()}
    </>
  )
}
