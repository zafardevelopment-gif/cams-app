'use client'

import { RBAC_MODULES, RBAC_ACTIONS, RBAC_SCOPES, FULL_ACCESS_ROLES } from '@/lib/rbac'
import type { RoleDefinition, RbacScope, PermissionMap } from '@/types'

interface Props {
  role: RoleDefinition
  permMap: PermissionMap
  scope: RbacScope
  readOnly: boolean
  onPermChange: (module: string, action: string, granted: boolean) => void
  onScopeChange: (scope: RbacScope) => void
}

/** Modules that require an extra confirmation step — shown with a lock icon */
const SENSITIVE_MODULES = new Set(['billing', 'settings'])

export function PermissionMatrix({ role, permMap, scope, readOnly, onPermChange, onScopeChange }: Props) {
  const isFullAccess = FULL_ACCESS_ROLES.includes(role.role_key as typeof FULL_ACCESS_ROLES[number])

  return (
    <div>
      {/* Scope selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--navy)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Data Scope
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RBAC_SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={readOnly || isFullAccess}
              onClick={() => onScopeChange(s.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: scope === s.key ? '2px solid var(--blue)' : '2px solid var(--gray-200)',
                background: scope === s.key ? '#EBF5FB' : 'white',
                color: scope === s.key ? 'var(--blue)' : 'var(--gray-600)',
                fontWeight: scope === s.key ? 700 : 400,
                fontSize: '0.8rem',
                cursor: readOnly || isFullAccess ? 'default' : 'pointer',
                opacity: readOnly || isFullAccess ? 0.6 : 1,
              }}
            >
              {s.label}
              <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 400, color: 'var(--gray-400)' }}>
                {s.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sensitive module notice */}
      {!readOnly && !isFullAccess && (
        <div style={{ marginBottom: 14, padding: '8px 12px', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 6, fontSize: '0.78rem', color: '#795548', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔒 <strong>Billing</strong> and <strong>Settings</strong> are sensitive modules. Grant access to these carefully.
        </div>
      )}

      {/* Permission grid */}
      {isFullAccess ? (
        <div style={{ padding: '16px 20px', background: '#E8F5E9', border: '1px solid #C8E6C9', borderRadius: 8, color: '#2E7D32', fontSize: '0.88rem' }}>
          ✅ <strong>Full Access</strong> — Hospital Admin has all permissions across all modules. This cannot be modified.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)', color: 'var(--navy)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 150 }}>
                  Module
                </th>
                {RBAC_ACTIONS.map((a) => (
                  <th key={a.key} style={{ textAlign: 'center', padding: '8px 10px', background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)', color: 'var(--navy)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 72 }}>
                    {a.label}
                  </th>
                ))}
                {!readOnly && (
                  <th style={{ textAlign: 'center', padding: '8px 10px', background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)', color: 'var(--gray-400)', fontSize: '0.7rem', minWidth: 64 }}>
                    All
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {RBAC_MODULES.map((mod, rowIdx) => {
                const isSensitive = SENSITIVE_MODULES.has(mod.key)
                const rowGranted = RBAC_ACTIONS.map((a) => permMap[`${mod.key}.${a.key}`] === true)
                const allGranted = rowGranted.every(Boolean)
                const noneGranted = rowGranted.every((v) => !v)
                const rowBg = isSensitive
                  ? (rowIdx % 2 === 0 ? '#FFFDE7' : '#FFF9C4')
                  : (rowIdx % 2 === 0 ? 'white' : 'var(--gray-50)')

                return (
                  <tr key={mod.key} style={{ background: rowBg }}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--gray-100)', fontWeight: 600, color: 'var(--navy)' }}>
                      <span style={{ marginRight: 6 }}>{mod.icon}</span>
                      {mod.label}
                      {isSensitive && (
                        <span title="Sensitive module — grant carefully" style={{ marginLeft: 6, fontSize: '0.7rem', background: '#FFE082', color: '#795548', padding: '1px 5px', borderRadius: 4 }}>
                          🔒 sensitive
                        </span>
                      )}
                    </td>
                    {RBAC_ACTIONS.map((act) => {
                      const key = `${mod.key}.${act.key}` as const
                      const checked = permMap[key] === true
                      return (
                        <td key={act.key} style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid var(--gray-100)' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={readOnly}
                            onChange={(e) => onPermChange(mod.key, act.key, e.target.checked)}
                            style={{ width: 16, height: 16, cursor: readOnly ? 'default' : 'pointer', accentColor: 'var(--blue)' }}
                          />
                        </td>
                      )
                    })}
                    {!readOnly && (
                      <td style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid var(--gray-100)' }}>
                        <button
                          type="button"
                          onClick={() => RBAC_ACTIONS.forEach((a) => onPermChange(mod.key, a.key, !allGranted))}
                          style={{
                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
                            border: '1px solid var(--gray-300)', cursor: 'pointer',
                            background: allGranted ? '#FFEBEE' : noneGranted ? '#E8F5E9' : 'var(--gray-50)',
                            color: allGranted ? '#C62828' : noneGranted ? '#2E7D32' : 'var(--gray-600)',
                          }}
                        >
                          {allGranted ? 'None' : 'All'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
