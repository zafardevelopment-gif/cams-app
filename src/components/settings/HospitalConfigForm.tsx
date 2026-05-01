'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveHospitalConfig } from '@/actions/hospitalConfig'
import {
  APPROVAL_ROLE_LABELS,
  type HospitalConfig,
  type ApprovalRole,
} from '@/lib/hospitalConfig'

const ALL_APPROVAL_ROLES: ApprovalRole[] = [
  'unit_head',
  'department_head',
  'head_nurse',
  'hospital_admin',
]

interface Props {
  config: HospitalConfig
}

export function HospitalConfigForm({ config: initial }: Props) {
  const [isPending, startTransition] = useTransition()
  const [cfg, setCfg] = useState(initial)

  function toggle(key: keyof Pick<HospitalConfig, 'hasBranches' | 'hasDepartments' | 'hasUnits'>) {
    setCfg((c) => ({ ...c, [key]: !c[key] }))
  }

  function toggleRole(role: ApprovalRole) {
    if (role === 'hospital_admin') return // always required, not toggleable
    setCfg((c) => ({
      ...c,
      approvalRoles: c.approvalRoles.includes(role)
        ? c.approvalRoles.filter((r) => r !== role)
        : [...c.approvalRoles, role],
    }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('hasBranches', String(cfg.hasBranches))
    fd.set('hasDepartments', String(cfg.hasDepartments))
    fd.set('hasUnits', String(cfg.hasUnits))
    cfg.approvalRoles.forEach((r) => fd.append('approvalRoles', r))

    startTransition(async () => {
      const result = await saveHospitalConfig(fd)
      if (result.success) {
        toast.success('Configuration saved — page will reload to apply changes')
        setTimeout(() => window.location.reload(), 1200)
      } else {
        toast.error(result.error ?? 'Save failed')
      }
    })
  }

  const STRUCTURE_OPTIONS: {
    key: keyof Pick<HospitalConfig, 'hasBranches' | 'hasDepartments' | 'hasUnits'>
    icon: string
    label: string
    desc: string
    warning?: string
  }[] = [
    {
      key: 'hasBranches',
      icon: '🏢',
      label: 'Branches',
      desc: 'Physical locations or campuses (e.g. Main Campus, North Clinic).',
      warning: 'Disabling branches will hide the Branches menu and skip that onboarding step.',
    },
    {
      key: 'hasDepartments',
      icon: '🏬',
      label: 'Departments',
      desc: 'Organisational units within a branch (e.g. ICU, Radiology, Pharmacy).',
      warning: 'Disabling departments will hide the Departments menu.',
    },
    {
      key: 'hasUnits',
      icon: '🔲',
      label: 'Units',
      desc: 'Sub-groups within a department (e.g. Ward A, Recovery Room).',
      warning: 'Disabling units will hide the Units menu and skip that onboarding step.',
    },
  ]

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Structure ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">🏗️ Hospital Structure</div>
            <div className="card-subtitle">
              Choose which organisational levels apply to your hospital.
              You can always change these later.
            </div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STRUCTURE_OPTIONS.map(({ key, icon, label, desc, warning }) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 10,
                border: `1px solid ${cfg[key] ? 'var(--blue)' : 'var(--gray-200)'}`,
                background: cfg[key] ? '#EBF5FB' : 'var(--gray-50)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)', lineHeight: 1.5 }}>{desc}</div>
                {!cfg[key] && warning && (
                  <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: 6, background: '#FFF8E1', padding: '4px 8px', borderRadius: 5, border: '1px solid #FFE082' }}>
                    ⚠️ {warning}
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
                <span style={{ fontSize: '0.82rem', color: cfg[key] ? 'var(--blue)' : 'var(--gray-400)', fontWeight: 600 }}>
                  {cfg[key] ? 'Enabled' : 'Disabled'}
                </span>
                <div
                  onClick={() => toggle(key)}
                  style={{
                    width: 44, height: 24, borderRadius: 99, cursor: 'pointer',
                    background: cfg[key] ? 'var(--blue)' : 'var(--gray-300)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: cfg[key] ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </label>
            </div>
          ))}

          {/* Structure summary */}
          <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: '0.82rem', color: 'var(--gray-600)' }}>
            <strong>Active structure:</strong>{' '}
            {[
              cfg.hasBranches && 'Branches',
              cfg.hasDepartments && 'Departments',
              cfg.hasUnits && 'Units',
            ].filter(Boolean).join(' → ') || 'No hierarchy (flat structure)'}
          </div>
        </div>
      </div>

      {/* ── Approval Workflow ─────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">✅ Approval Workflow</div>
            <div className="card-subtitle">
              Select which roles must approve an assessment before it is marked as passed.
              Hospital Admin is always the final approver.
            </div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ALL_APPROVAL_ROLES.map((role) => {
            const checked = cfg.approvalRoles.includes(role)
            const locked = role === 'hospital_admin'
            return (
              <label
                key={role}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8, cursor: locked ? 'default' : 'pointer',
                  border: `1px solid ${checked ? 'var(--blue)' : 'var(--gray-200)'}`,
                  background: checked ? '#EBF5FB' : 'var(--gray-50)',
                  opacity: locked ? 0.75 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => toggleRole(role)}
                  style={{ width: 16, height: 16, accentColor: 'var(--blue)', cursor: locked ? 'default' : 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)' }}>
                    {APPROVAL_ROLE_LABELS[role]}
                    {locked && (
                      <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 400 }}>
                        (always required)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>
                    {role === 'unit_head' && 'Reviews assessment at unit level'}
                    {role === 'department_head' && 'Reviews assessment at department level'}
                    {role === 'head_nurse' && 'Reviews assessment for clinical sign-off'}
                    {role === 'hospital_admin' && 'Final approval — issues the certificate'}
                  </div>
                </div>
                {checked && !locked && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--blue)', background: '#BBDEFB', padding: '2px 8px', borderRadius: 99 }}>
                    Active
                  </span>
                )}
              </label>
            )
          })}

          {/* Workflow summary */}
          <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: '0.82rem', color: 'var(--gray-600)' }}>
            <strong>Approval chain:</strong>{' '}
            Staff submits →{' '}
            {cfg.approvalRoles
              .filter((r) => r !== 'hospital_admin')
              .map((r) => APPROVAL_ROLE_LABELS[r])
              .join(' → ')}
            {cfg.approvalRoles.filter((r) => r !== 'hospital_admin').length > 0 ? ' → ' : ' '}
            Hospital Admin → Certificate issued
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>
    </form>
  )
}
