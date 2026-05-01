'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createUser } from '@/actions/staff'
import { getRoleLabel } from '@/lib/utils'

interface RoleOption {
  role_key: string
  display_name: string
  is_system: boolean
}

interface Props {
  departments: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  roleOptions?: RoleOption[]
  onClose: () => void
}

const EMPTY = {
  full_name: '', email: '', password: '', role: '', job_title: '', phone: '',
  employee_id: '', nursing_license: '', license_expiry: '', hired_date: '',
  department_id: '', branch_id: '', unit_id: '',
}

export function CreateUserModal({ departments, branches, roleOptions = [], onClose }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [isPending, startTransition] = useTransition()
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-control" value={form.department_id} onChange={set('department_id')}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <select className="form-control" value={form.branch_id} onChange={set('branch_id')}>
                  <option value="">None</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
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
