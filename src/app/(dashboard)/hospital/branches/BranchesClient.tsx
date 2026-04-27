'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createBranch, updateBranch, toggleBranchStatus } from '@/actions/branches'
import type { Branch } from '@/types'

interface Props { branches: Branch[] }

const EMPTY_FORM = { name: '', name_ar: '', city: '', address: '', contact_email: '', contact_phone: '' }

export function BranchesClient({ branches: initial }: Props) {
  const [branches, setBranches] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(b: Branch) {
    setEditing(b)
    setForm({
      name: b.name,
      name_ar: b.name_ar ?? '',
      city: b.city ?? '',
      address: b.address ?? '',
      contact_email: b.contact_email ?? '',
      contact_phone: b.contact_phone ?? '',
    })
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))

    startTransition(async () => {
      const result = editing
        ? await updateBranch(editing.id, fd)
        : await createBranch(fd)

      if (result.success) {
        toast.success(editing ? 'Branch updated' : 'Branch created')
        setShowForm(false)
        // Optimistic local update — page will revalidate in bg
        if (editing) {
          setBranches((prev) => prev.map((b) => b.id === editing.id ? { ...b, ...form } : b))
        } else {
          // Force reload to get new ID from server
          window.location.reload()
        }
      } else {
        toast.error(result.error ?? 'Failed')
      }
    })
  }

  function handleToggle(b: Branch) {
    startTransition(async () => {
      const result = await toggleBranchStatus(b.id, !b.is_active)
      if (result.success) {
        setBranches((prev) => prev.map((x) => x.id === b.id ? { ...x, is_active: !b.is_active } : x))
        toast.success(b.is_active ? 'Branch deactivated' : 'Branch activated')
      } else {
        toast.error(result.error ?? 'Failed')
      }
    })
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All Branches</div>
            <div className="card-subtitle">{branches.length} branch{branches.length !== 1 ? 'es' : ''}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Add Branch</button>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      {b.name_ar && <div className="text-xs text-muted">{b.name_ar}</div>}
                    </td>
                    <td className="text-sm">{b.city ?? '—'}</td>
                    <td className="text-sm">
                      {b.contact_email && <div>{b.contact_email}</div>}
                      {b.contact_phone && <div className="text-muted">{b.contact_phone}</div>}
                      {!b.contact_email && !b.contact_phone && '—'}
                    </td>
                    <td>
                      <span className={`badge ${b.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(b)}>Edit</button>
                        <button
                          className={`btn btn-sm ${b.is_active ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleToggle(b)}
                          disabled={isPending}
                        >
                          {b.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                      No branches yet. Click "Add Branch" to create one.
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
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Branch' : 'Add Branch'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Branch Name (EN) *</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      minLength={2}
                      maxLength={150}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Branch Name (AR)</label>
                    <input
                      className="form-control"
                      value={form.name_ar}
                      onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                      maxLength={150}
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      className="form-control"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input
                      className="form-control"
                      value={form.contact_phone}
                      onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                      maxLength={30}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    maxLength={254}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-control"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    rows={2}
                    maxLength={300}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
