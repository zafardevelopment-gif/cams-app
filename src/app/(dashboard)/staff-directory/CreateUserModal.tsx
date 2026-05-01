'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { createUser } from '@/actions/staff'
import { getRoleLabel } from '@/lib/utils'

interface RoleOption {
  role_key: string
  display_name: string
  is_system: boolean
}

interface UnitRow {
  id: string
  name: string
  department_id: string | null
  branch_id: string | null
}

interface Props {
  departments: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  units: UnitRow[]
  roleOptions?: RoleOption[]
  onClose: () => void
}

// Which org fields each role needs
type OrgLevel = 'none' | 'branch' | 'branch+dept' | 'branch+dept+unit'

const ROLE_ORG: Record<string, OrgLevel> = {
  super_admin:      'none',
  hospital_admin:   'none',
  hr_quality:       'none',
  auditor:          'none',
  branch_admin:     'branch',
  department_head:  'branch+dept',
  unit_head:        'branch+dept+unit',
  head_nurse:       'branch+dept+unit',
  educator:         'branch+dept',
  assessor:         'branch+dept',
  staff:            'branch+dept+unit',
}

function orgLevel(role: string): OrgLevel {
  return ROLE_ORG[role] ?? 'branch+dept+unit'
}

const EMPTY = {
  full_name: '', email: '', password: '', role: '', job_title: '', phone: '',
  employee_id: '', nursing_license: '', license_expiry: '', hired_date: '',
  department_id: '', branch_id: '', unit_id: '',
}

export function CreateUserModal({ departments, branches, units, roleOptions = [], onClose }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [isPending, startTransition] = useTransition()

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: val }
      // Cascade: branch change resets department + unit
      if (k === 'branch_id') { next.department_id = ''; next.unit_id = '' }
      // Cascade: department change resets unit
      if (k === 'department_id') { next.unit_id = '' }
      // Role change resets org fields
      if (k === 'role') { next.branch_id = ''; next.department_id = ''; next.unit_id = '' }
      return next
    })
  }

  const level = orgLevel(form.role)
  const showBranch = branches.length > 0 && (level === 'branch' || level === 'branch+dept' || level === 'branch+dept+unit')
  const showDept   = departments.length > 0 && (level === 'branch+dept' || level === 'branch+dept+unit')
  const showUnit   = units.length > 0 && level === 'branch+dept+unit'

  // Filter departments by selected branch (if branch selected)
  const filteredDepts = useMemo(() => {
    if (!form.branch_id) return departments
    // Departments that have at least one unit in this branch, OR all depts if no branch-dept link exists in units
    const deptsWithBranchUnits = new Set(
      units.filter((u) => u.branch_id === form.branch_id && u.department_id).map((u) => u.department_id!)
    )
    if (deptsWithBranchUnits.size === 0) return departments
    return departments.filter((d) => deptsWithBranchUnits.has(d.id))
  }, [departments, units, form.branch_id])

  // Filter units by selected department (and branch if set)
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (form.department_id && u.department_id !== form.department_id) return false
      if (form.branch_id && u.branch_id && u.branch_id !== form.branch_id) return false
      return true
    })
  }, [units, form.department_id, form.branch_id])

  // Required org field validation
  function validate(): string | null {
    if (level === 'branch' && branches.length > 0 && !form.branch_id) return 'Branch is required for this role'
    if ((level === 'branch+dept' || level === 'branch+dept+unit') && departments.length > 0 && !form.department_id) {
      return 'Department is required for this role'
    }
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { toast.error(err); return }
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))
    startTransition(async () => {
      const r = await createUser(fd)
      if (r.success) {
        toast.success('User created successfully')
        onClose()
        window.location.reload()
      } else {
        toast.error(r.error ?? 'Failed')
      }
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>Add Staff Member</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

            {/* Row 1: Name + Email */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" value={form.full_name} onChange={set('full_name')} required minLength={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-control" value={form.email} onChange={set('email')} required />
              </div>
            </div>

            {/* Row 2: Password + Role */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" className="form-control" value={form.password} onChange={set('password')} required minLength={8} placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-control" value={form.role} onChange={set('role')} required>
                  <option value="" disabled>— Select a role —</option>
                  {roleOptions.length > 0 ? (
                    <>
                      <optgroup label="System Roles">
                        {roleOptions.filter((r) => r.is_system).map((r) => (
                          <option key={r.role_key} value={r.role_key}>{r.display_name}</option>
                        ))}
                      </optgroup>
                      {roleOptions.some((r) => !r.is_system) && (
                        <optgroup label="Custom Roles">
                          {roleOptions.filter((r) => !r.is_system).map((r) => (
                            <option key={r.role_key} value={r.role_key}>{r.display_name}</option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    ['staff','assessor','educator','head_nurse','unit_head','department_head','hr_quality','branch_admin','hospital_admin','auditor'].map((r) => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Row 3: Job Title + Phone */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input className="form-control" value={form.job_title} onChange={set('job_title')} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" className="form-control" value={form.phone} onChange={set('phone')} />
              </div>
            </div>

            {/* Row 4: Employee ID + Nursing License */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input className="form-control" value={form.employee_id} onChange={set('employee_id')} />
              </div>
              <div className="form-group">
                <label className="form-label">Nursing License</label>
                <input className="form-control" value={form.nursing_license} onChange={set('nursing_license')} />
              </div>
            </div>

            {/* Row 5: License Expiry + Hired Date */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">License Expiry</label>
                <input type="date" className="form-control" value={form.license_expiry} onChange={set('license_expiry')} />
              </div>
              <div className="form-group">
                <label className="form-label">Hired Date</label>
                <input type="date" className="form-control" value={form.hired_date} onChange={set('hired_date')} />
              </div>
            </div>

            {/* Org section — only when role is selected and at least one field is needed */}
            {form.role && (showBranch || showDept || showUnit) && (
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Organization Assignment
                </div>

                {/* Branch row */}
                {showBranch && (
                  <div className="form-group">
                    <label className="form-label">
                      Branch {level === 'branch' ? '*' : ''}
                    </label>
                    <select
                      className="form-control"
                      value={form.branch_id}
                      onChange={set('branch_id')}
                      required={level === 'branch' && branches.length > 0}
                    >
                      <option value="">— None —</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Dept + Unit in a 2-col grid when both visible */}
                {showDept && showUnit ? (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Department *</label>
                      <select
                        className="form-control"
                        value={form.department_id}
                        onChange={set('department_id')}
                        required={departments.length > 0}
                      >
                        <option value="">— None —</option>
                        {filteredDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <select
                        className="form-control"
                        value={form.unit_id}
                        onChange={set('unit_id')}
                        disabled={filteredUnits.length === 0}
                      >
                        <option value="">— None —</option>
                        {filteredUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                ) : showDept ? (
                  <div className="form-group">
                    <label className="form-label">
                      Department {(level === 'branch+dept' || level === 'branch+dept+unit') ? '*' : ''}
                    </label>
                    <select
                      className="form-control"
                      value={form.department_id}
                      onChange={set('department_id')}
                      required={departments.length > 0}
                    >
                      <option value="">— None —</option>
                      {filteredDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                ) : null}
              </div>
            )}

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
