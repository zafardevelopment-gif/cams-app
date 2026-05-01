'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createRoleDefinition,
  updateRoleDefinition,
  saveRolePermissions,
  deleteRoleDefinition,
  resetRolePermissions,
  cloneRoleDefinition,
} from '@/actions/roles'
import {
  toPermissionMap, emptyPermissionMap, fullPermissionMap,
  FULL_ACCESS_ROLES, RBAC_MODULES, RBAC_ACTIONS, DEFAULT_SCOPE_BY_ROLE,
} from '@/lib/rbac'
import { PermissionMatrix } from './PermissionMatrix'
import type { RoleDefinition, RbacScope, PermissionMap } from '@/types'

interface Props {
  roles: RoleDefinition[]
  hospitalId: string
}

type ModalMode = 'create' | 'edit' | 'permissions' | 'view_permissions' | 'delete' | 'clone' | 'reset_confirm' | null

export function RolesClient({ roles: initialRoles, hospitalId }: Props) {
  const [roles, setRoles] = useState(initialRoles)
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<RoleDefinition | null>(null)
  const [isPending, startTransition] = useTransition()

  const [createForm, setCreateForm] = useState({ display_name: '', role_key: '', description: '', scope: 'hospital' as RbacScope })
  const [editForm, setEditForm]     = useState({ display_name: '', description: '' })
  const [cloneForm, setCloneForm]   = useState({ display_name: '', role_key: '' })
  const [permMap, setPermMap]       = useState<PermissionMap>({})
  const [permScope, setPermScope]   = useState<RbacScope>('hospital')

  // ── open helpers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setCreateForm({ display_name: '', role_key: '', description: '', scope: 'hospital' })
    setModal('create')
  }

  function openEdit(r: RoleDefinition) {
    setSelected(r)
    setEditForm({ display_name: r.display_name, description: r.description ?? '' })
    setModal('edit')
  }

  function openPermissions(r: RoleDefinition) {
    setSelected(r)
    const isFullAccess = FULL_ACCESS_ROLES.includes(r.role_key as typeof FULL_ACCESS_ROLES[number])
    setPermMap(isFullAccess ? fullPermissionMap() : (r.permissions?.length ? toPermissionMap(r.permissions) : emptyPermissionMap()))
    setPermScope((r.permissions?.[0]?.scope ?? DEFAULT_SCOPE_BY_ROLE[r.role_key] ?? 'hospital') as RbacScope)
    setModal('permissions')
  }

  function openClone(r: RoleDefinition) {
    setSelected(r)
    const name = `${r.display_name} (Copy)`
    const key  = `${r.role_key}_copy`
    setCloneForm({ display_name: name, role_key: key })
    setModal('clone')
  }

  function openDelete(r: RoleDefinition) {
    setSelected(r)
    setModal('delete')
  }

  function openResetConfirm(r: RoleDefinition) {
    setSelected(r)
    setModal('reset_confirm')
  }

  function openViewPermissions(r: RoleDefinition) {
    setSelected(r)
    const isFullAccess = FULL_ACCESS_ROLES.includes(r.role_key as typeof FULL_ACCESS_ROLES[number])
    setPermMap(isFullAccess ? fullPermissionMap() : (r.permissions?.length ? toPermissionMap(r.permissions) : emptyPermissionMap()))
    setPermScope((r.permissions?.[0]?.scope ?? DEFAULT_SCOPE_BY_ROLE[r.role_key] ?? 'hospital') as RbacScope)
    setModal('view_permissions')
  }

  function closeModal() { setModal(null); setSelected(null) }

  function handleNameChange(name: string) {
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    setCreateForm((f) => ({ ...f, display_name: name, role_key: key }))
  }

  // ── handlers ──────────────────────────────────────────────────────────────────

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('display_name', createForm.display_name)
    fd.set('role_key', createForm.role_key)
    fd.set('description', createForm.description)
    fd.set('scope', createForm.scope)
    startTransition(async () => {
      const result = await createRoleDefinition(fd)
      if (result.success && result.data) {
        toast.success('Role created')
        setRoles((prev) => [...prev, {
          id: result.data!.id, hospital_id: hospitalId, role_key: createForm.role_key,
          display_name: createForm.display_name, description: createForm.description || null,
          is_system: false, is_active: true,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(), permissions: [],
        }])
        closeModal()
      } else { toast.error(result.error ?? 'Failed to create role') }
    })
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const fd = new FormData()
    fd.set('display_name', editForm.display_name)
    fd.set('description', editForm.description)
    startTransition(async () => {
      const result = await updateRoleDefinition(selected.id, fd)
      if (result.success) {
        toast.success('Role updated')
        setRoles((prev) => prev.map((r) => r.id === selected.id
          ? { ...r, display_name: editForm.display_name, description: editForm.description || null }
          : r))
        closeModal()
      } else { toast.error(result.error ?? 'Failed') }
    })
  }

  function handleSavePermissions(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const perms = RBAC_MODULES.flatMap((m) =>
      RBAC_ACTIONS.map((a) => ({ module: m.key, action: a.key, scope: permScope, granted: permMap[`${m.key}.${a.key}`] === true }))
    )
    startTransition(async () => {
      const result = await saveRolePermissions(selected.id, perms)
      if (result.success) {
        toast.success('Permissions saved')
        setRoles((prev) => prev.map((r) => r.id === selected.id
          ? { ...r, permissions: perms.map((p, i) => ({ id: `tmp-${i}`, role_definition_id: r.id, ...p, created_at: new Date().toISOString() })) }
          : r))
        closeModal()
      } else { toast.error(result.error ?? 'Failed to save permissions') }
    })
  }

  function handleReset() {
    if (!selected) return
    startTransition(async () => {
      const result = await resetRolePermissions(selected.id)
      if (result.success) {
        toast.success('Permissions reset to system defaults')
        closeModal()
        // Reload page so fresh permissions are shown
        window.location.reload()
      } else { toast.error(result.error ?? 'Failed to reset') }
    })
  }

  function handleClone(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    startTransition(async () => {
      const result = await cloneRoleDefinition(selected.id, cloneForm.display_name, cloneForm.role_key)
      if (result.success && result.data) {
        toast.success('Role cloned')
        closeModal()
        window.location.reload()
      } else { toast.error(result.error ?? 'Failed to clone role') }
    })
  }

  function handleDelete() {
    if (!selected) return
    startTransition(async () => {
      const result = await deleteRoleDefinition(selected.id)
      if (result.success) {
        toast.success('Role deleted')
        setRoles((prev) => prev.filter((r) => r.id !== selected.id))
        closeModal()
      } else { toast.error(result.error ?? 'Failed to delete role') }
    })
  }

  // ── derived ───────────────────────────────────────────────────────────────────

  const systemRoles = roles.filter((r) => r.is_system)
  const customRoles = roles.filter((r) => !r.is_system && r.hospital_id === hospitalId)

  function grantedCount(r: RoleDefinition) {
    if (FULL_ACCESS_ROLES.includes(r.role_key as typeof FULL_ACCESS_ROLES[number])) return 48
    return (r.permissions ?? []).filter((p) => p.granted).length
  }

  // ── Permission summary (top 3 modules with granted actions) ──────────────────

  function permissionSummary(r: RoleDefinition): { module: string; actions: string[] }[] {
    if (FULL_ACCESS_ROLES.includes(r.role_key as typeof FULL_ACCESS_ROLES[number])) {
      return RBAC_MODULES.slice(0, 3).map((m) => ({ module: m.label, actions: ['Full Access'] }))
    }
    const perms = r.permissions ?? []
    const result: { module: string; actions: string[] }[] = []
    for (const mod of RBAC_MODULES) {
      const granted = RBAC_ACTIONS.filter((a) => perms.find((p) => p.module === mod.key && p.action === a.key && p.granted))
        .map((a) => a.label)
      if (granted.length > 0) result.push({ module: mod.label, actions: granted })
      if (result.length === 3) break
    }
    return result
  }

  // ── RoleCard ──────────────────────────────────────────────────────────────────

  function RoleCard({ r }: { r: RoleDefinition }) {
    const isFullAccess = FULL_ACCESS_ROLES.includes(r.role_key as typeof FULL_ACCESS_ROLES[number])
    const granted = grantedCount(r)
    const scope = r.permissions?.[0]?.scope ?? DEFAULT_SCOPE_BY_ROLE[r.role_key] ?? 'hospital'
    const pct = Math.round((granted / 48) * 100)
    const summary = permissionSummary(r)

    return (
      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: '16px 18px', background: 'white' }}>
        {/* Top row: icon + info + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {/* Icon */}
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: r.is_system ? '#EBF5FB' : '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {r.is_system ? '🔑' : '🎭'}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.95rem' }}>{r.display_name}</span>
              {r.is_system && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#EBF5FB', color: 'var(--blue)', padding: '2px 6px', borderRadius: 99 }}>SYSTEM</span>}
              <span style={{ fontSize: '0.65rem', background: 'var(--gray-100)', color: 'var(--gray-500)', padding: '2px 6px', borderRadius: 99, fontFamily: 'monospace' }}>{r.role_key}</span>
            </div>
            {r.description && <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>{r.description}</div>}
            <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: '0.75rem', color: 'var(--gray-400)', alignItems: 'center' }}>
              <span>📍 Scope: <strong style={{ color: 'var(--gray-600)' }}>{scope}</strong></span>
              {isFullAccess ? (
                <span style={{ color: '#2E7D32', fontWeight: 600 }}>✅ Full access</span>
              ) : (
                <>
                  <span>{granted}/48 permissions</span>
                  <div style={{ width: 60, height: 4, background: 'var(--gray-200)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct > 60 ? 'var(--blue)' : pct > 30 ? '#FF9800' : 'var(--gray-400)', borderRadius: 2 }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => openViewPermissions(r)}>👁 View</button>
            <button className="btn btn-primary btn-sm" onClick={() => openPermissions(r)}>🔐 Edit</button>
            <button className="btn btn-secondary btn-sm" onClick={() => openClone(r)}>📋 Clone</button>
            {!r.is_system && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>Rename</button>
                <button
                  className="btn btn-sm"
                  style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2' }}
                  onClick={() => openDelete(r)}
                >Delete</button>
              </>
            )}
            {r.is_system && !isFullAccess && (
              <button
                className="btn btn-sm"
                style={{ background: '#FFF8E1', color: '#795548', border: '1px solid #FFE082', fontSize: '0.75rem' }}
                onClick={() => openResetConfirm(r)}
              >↺ Reset</button>
            )}
          </div>
        </div>

        {/* Permission summary row */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Key access:</span>
          {isFullAccess ? (
            <span style={{ fontSize: '0.75rem', background: '#E8F5E9', color: '#2E7D32', padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>All modules · All actions</span>
          ) : summary.length > 0 ? (
            summary.map((s) => (
              <span key={s.module} style={{ fontSize: '0.72rem', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', color: 'var(--gray-600)', padding: '2px 8px', borderRadius: 99 }}>
                <strong style={{ color: 'var(--navy)' }}>{s.module}:</strong> {s.actions.slice(0, 3).join(', ')}
                {s.actions.length > 3 && ` +${s.actions.length - 3}`}
              </span>
            ))
          ) : (
            <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>No permissions granted yet</span>
          )}
        </div>
      </div>
    )
  }

  const isFullAccessSelected = selected ? FULL_ACCESS_ROLES.includes(selected.role_key as typeof FULL_ACCESS_ROLES[number]) : false

  return (
    <>
      {/* System roles */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">System Roles</div>
            <div className="card-subtitle">Built-in roles — permissions editable per hospital, names/keys cannot be changed</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {systemRoles.map((r) => <RoleCard key={r.id} r={r} />)}
        </div>
      </div>

      {/* Custom roles */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Custom Roles</div>
            <div className="card-subtitle">{customRoles.length} custom role{customRoles.length !== 1 ? 's' : ''} defined for this hospital</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Create Role</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customRoles.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--gray-400)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎭</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No custom roles yet</div>
              <div style={{ fontSize: '0.85rem' }}>Create or clone a role for your hospital&apos;s unique needs.</div>
            </div>
          ) : customRoles.map((r) => <RoleCard key={r.id} r={r} />)}
        </div>
      </div>

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
      {modal === 'create' && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Create Custom Role</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Role Name *</label>
                  <input className="form-control" placeholder="e.g. Ward Coordinator" value={createForm.display_name} onChange={(e) => handleNameChange(e.target.value)} required minLength={2} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role Key *</label>
                  <input className="form-control" placeholder="e.g. ward_coordinator" value={createForm.role_key} onChange={(e) => { const v = e.target.value; setCreateForm((f) => ({ ...f, role_key: v })) }} pattern="[a-z0-9_]+" title="Lowercase letters, numbers and underscores only" required />
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 4 }}>Lowercase letters, numbers, underscores. Auto-generated from name.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} placeholder="What can this role do?" value={createForm.description} onChange={(e) => { const v = e.target.value; setCreateForm((f) => ({ ...f, description: v })) }} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Scope</label>
                  <select className="form-control" value={createForm.scope} onChange={(e) => { const v = e.target.value as RbacScope; setCreateForm((f) => ({ ...f, scope: v })) }}>
                    <option value="hospital">Hospital — all data in hospital</option>
                    <option value="branch">Branch — data within assigned branch</option>
                    <option value="department">Department — data within assigned department</option>
                    <option value="unit">Unit — data within assigned unit only</option>
                  </select>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', background: 'var(--gray-50)', padding: '10px 12px', borderRadius: 6 }}>
                  ℹ️ You can edit individual permissions after creating the role.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Creating…' : 'Create Role'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      {modal === 'edit' && selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Edit Role</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Role Name *</label>
                  <input className="form-control" value={editForm.display_name} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, display_name: v })) }} required minLength={2} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} value={editForm.description} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, description: v })) }} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Clone modal ──────────────────────────────────────────────────────── */}
      {modal === 'clone' && selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>📋 Clone Role</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleClone}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 16 }}>
                  Cloning <strong>{selected.display_name}</strong> — all permissions will be copied to the new role.
                </p>
                <div className="form-group">
                  <label className="form-label">New Role Name *</label>
                  <input className="form-control" value={cloneForm.display_name} onChange={(e) => { const v = e.target.value; setCloneForm((f) => ({ ...f, display_name: v })) }} required minLength={2} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Role Key *</label>
                  <input className="form-control" value={cloneForm.role_key} onChange={(e) => { const v = e.target.value; setCloneForm((f) => ({ ...f, role_key: v })) }} pattern="[a-z0-9_]+" title="Lowercase letters, numbers and underscores only" required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Cloning…' : 'Clone Role'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Permissions modal ────────────────────────────────────────────────── */}
      {modal === 'permissions' && selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <h3>
                🔐 {selected.display_name}
                <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 400, color: 'var(--gray-400)' }}>
                  {selected.is_system ? 'System role' : 'Custom role'} · {selected.role_key}
                </span>
              </h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSavePermissions}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <PermissionMatrix
                  role={selected}
                  permMap={permMap}
                  scope={permScope}
                  readOnly={isFullAccessSelected}
                  onPermChange={(module, action, granted) => setPermMap((prev) => ({ ...prev, [`${module}.${action}`]: granted }))}
                  onScopeChange={(s) => setPermScope(s)}
                />
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div>
                  {selected.is_system && !isFullAccessSelected && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ background: '#FFF8E1', color: '#795548', border: '1px solid #FFE082' }}
                      onClick={() => { closeModal(); openResetConfirm(selected) }}
                    >
                      ↺ Reset to Default
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  {!isFullAccessSelected && (
                    <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Saving…' : 'Save Permissions'}</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Permissions (read-only) modal ──────────────────────────────── */}
      {modal === 'view_permissions' && selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <h3>
                👁 {selected.display_name} — Permissions
                <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 400, color: 'var(--gray-400)' }}>
                  {selected.is_system ? 'System role' : 'Custom role'} · {selected.role_key} · read-only
                </span>
              </h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <PermissionMatrix
                role={selected}
                permMap={permMap}
                scope={permScope}
                readOnly={true}
                onPermChange={() => {}}
                onScopeChange={() => {}}
              />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                Read-only view — click <strong>Edit Permissions</strong> on the role card to make changes.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Close</button>
                {!FULL_ACCESS_ROLES.includes(selected.role_key as typeof FULL_ACCESS_ROLES[number]) && (
                  <button type="button" className="btn btn-primary" onClick={() => { closeModal(); openPermissions(selected) }}>
                    🔐 Edit Permissions
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirm modal ──────────────────────────────────────────────── */}
      {modal === 'reset_confirm' && selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>↺ Reset to Default</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>
                This will restore <strong>{selected.display_name}</strong>&apos;s permissions to the built-in system defaults,
                discarding any customisations you have made.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#795548', borderColor: '#795548' }}
                onClick={handleReset}
                disabled={isPending}
              >{isPending ? 'Resetting…' : 'Yes, Reset'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      {modal === 'delete' && selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Delete Role</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>
                Are you sure you want to delete <strong>{selected.display_name}</strong>?
                This permanently removes the role and its permissions.
                Users with this role key will need to be reassigned manually.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#C62828', borderColor: '#C62828' }}
                onClick={handleDelete}
                disabled={isPending}
              >{isPending ? 'Deleting…' : 'Delete Role'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
