'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createBranch, updateBranch, toggleBranchStatus } from '@/actions/branches'
import type { Branch } from '@/types'
import { BranchZeroState, NextStepsBanner } from '@/components/onboarding/OnboardingComponents'

interface Props { branches: Branch[] }

const EMPTY_FORM = { name: '', name_ar: '', city: '', address: '', contact_email: '', contact_phone: '' }

export function BranchesClient({ branches: initial }: Props) {
  const [branches, setBranches] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [justCreated, setJustCreated] = useState<string | null>(null)

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
        if (editing) {
          setBranches((prev) => prev.map((b) => b.id === editing.id ? { ...b, ...form } : b))
        } else {
          if (!editing) setJustCreated(form.name)
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

  // Zero state — no branches at all
  if (branches.length === 0 && !showForm) {
    return (
      <>
        <BranchZeroState onCreateClick={openCreate} />
        {showForm && renderForm()}
      </>
    )
  }

  function renderForm() {
    return (
      <div className="modal-backdrop">
        <div className="modal" style={{ maxWidth: 500 }}>
          <div className="modal-header">
            <h3>{editing ? 'Edit Branch' : 'Add Branch'}</h3>
            <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: 16 }}>
                A branch represents a physical location or campus of your hospital (e.g. "Main Campus", "North Wing").
              </p>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Branch Name (English) *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Main Campus"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    minLength={2}
                    maxLength={150}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch Name (Arabic)</label>
                  <input
                    className="form-control"
                    placeholder="اسم الفرع بالعربي"
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
                    placeholder="e.g. Riyadh"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    className="form-control"
                    placeholder="e.g. +966 11 000 0000"
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
                  placeholder="e.g. branch@hospital.sa"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  maxLength={254}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  className="form-control"
                  placeholder="Full street address (optional)"
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
    )
  }

  return (
    <>
      {/* Post-creation guidance banner */}
      {justCreated && (
        <NextStepsBanner
          title={`Branch "${justCreated}" created successfully!`}
          subtitle="Complete your setup to start using CAMS."
          actions={[
            { label: '🏬 Create Department', href: '/hospital/departments', primary: true },
            { label: '🔲 Create Unit', href: '/hospital/units' },
            { label: '👥 Add Staff', href: '/staff-directory' },
          ]}
          onDismiss={() => setJustCreated(null)}
        />
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All Branches</div>
            <div className="card-subtitle">{branches.length} branch{branches.length !== 1 ? 'es' : ''} · Each branch can have its own departments and units</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Add Branch</button>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Branch Name</th>
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
                      {!b.contact_email && !b.contact_phone && <span className="text-muted">—</span>}
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
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Setup next steps hint when branches exist but may need more setup */}
      {branches.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="card" style={{ background: '#F8FAFC' }}>
            <div className="card-body" style={{ padding: '14px 18px' }}>
              <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 10 }}>📋 What to do next</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { href: '/hospital/departments', label: '🏬 Manage Departments' },
                  { href: '/hospital/units',       label: '🔲 Manage Units' },
                  { href: '/staff-directory',      label: '👥 Add Staff' },
                  { href: '/competencies',         label: '📚 Competency Templates' },
                ].map((a) => (
                  <a key={a.href} href={a.href} className="btn btn-secondary btn-sm">{a.label}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && renderForm()}
    </>
  )
}
