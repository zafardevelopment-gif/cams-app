/**
 * RBAC constants and helpers.
 * This module is shared by server actions, server pages, and client components.
 * It has NO side effects and no Supabase imports — safe to import anywhere.
 */

import type { RbacModule, RbacAction, RbacScope, RolePermission, PermissionMap } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const RBAC_MODULES: { key: RbacModule; label: string; icon: string }[] = [
  { key: 'staff',        label: 'Staff',          icon: '👥' },
  { key: 'departments',  label: 'Departments',    icon: '🏬' },
  { key: 'units',        label: 'Units',          icon: '🔲' },
  { key: 'competencies', label: 'Competencies',   icon: '📚' },
  { key: 'assessments',  label: 'Assessments',    icon: '✅' },
  { key: 'reports',      label: 'Reports',        icon: '📊' },
  { key: 'billing',      label: 'Billing',        icon: '💳' },
  { key: 'settings',     label: 'Settings',       icon: '⚙️' },
]

export const RBAC_ACTIONS: { key: RbacAction; label: string }[] = [
  { key: 'view',    label: 'View'    },
  { key: 'create',  label: 'Create'  },
  { key: 'edit',    label: 'Edit'    },
  { key: 'delete',  label: 'Delete'  },
  { key: 'approve', label: 'Approve' },
  { key: 'assign',  label: 'Assign'  },
]

export const RBAC_SCOPES: { key: RbacScope; label: string; desc: string }[] = [
  { key: 'hospital',   label: 'Hospital',   desc: 'All data in the hospital' },
  { key: 'branch',     label: 'Branch',     desc: 'Data within assigned branch' },
  { key: 'department', label: 'Department', desc: 'Data within assigned department' },
  { key: 'unit',       label: 'Unit',       desc: 'Data within assigned unit only' },
]

/** Roles that always have full access — cannot be edited via the RBAC UI */
export const FULL_ACCESS_ROLES = ['hospital_admin', 'super_admin'] as const

/** Maps a UserRole string to its default scope for display purposes */
export const DEFAULT_SCOPE_BY_ROLE: Record<string, RbacScope> = {
  hospital_admin:  'hospital',
  branch_admin:    'branch',
  department_head: 'department',
  unit_head:       'unit',
  head_nurse:      'unit',
  educator:        'hospital',
  hr_quality:      'hospital',
  assessor:        'hospital',
  staff:           'unit',
  auditor:         'hospital',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a flat array of RolePermission rows to a PermissionMap lookup */
export function toPermissionMap(permissions: RolePermission[]): PermissionMap {
  const map: PermissionMap = {}
  for (const p of permissions) {
    map[`${p.module}.${p.action}`] = p.granted
  }
  return map
}

/** Build an empty full permission map (all false) for the matrix UI */
export function emptyPermissionMap(): PermissionMap {
  const map: PermissionMap = {}
  for (const m of RBAC_MODULES) {
    for (const a of RBAC_ACTIONS) {
      map[`${m.key}.${a.key}`] = false
    }
  }
  return map
}

/** Build a full-access permission map (all true) — used for hospital_admin seed */
export function fullPermissionMap(): PermissionMap {
  const map: PermissionMap = {}
  for (const m of RBAC_MODULES) {
    for (const a of RBAC_ACTIONS) {
      map[`${m.key}.${a.key}`] = true
    }
  }
  return map
}

/** Check a single permission */
export function can(map: PermissionMap, module: RbacModule, action: RbacAction): boolean {
  return map[`${module}.${action}`] === true
}
