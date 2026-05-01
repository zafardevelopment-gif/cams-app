/**
 * Hospital configuration stored in CAMS_settings as key='hospital_config'.
 * No schema changes needed — uses the existing settings table.
 */

export interface HospitalConfig {
  hasBranches: boolean
  hasDepartments: boolean
  hasUnits: boolean
  approvalRoles: ApprovalRole[]
}

export type ApprovalRole = 'unit_head' | 'department_head' | 'head_nurse' | 'hospital_admin'

export const DEFAULT_CONFIG: HospitalConfig = {
  hasBranches: true,
  hasDepartments: true,
  hasUnits: true,
  approvalRoles: ['head_nurse', 'hospital_admin'],
}

export const APPROVAL_ROLE_LABELS: Record<ApprovalRole, string> = {
  unit_head: 'Unit Head',
  department_head: 'Department Head',
  head_nurse: 'Head Nurse',
  hospital_admin: 'Hospital Admin',
}

export const SETTINGS_KEY = 'hospital_config'

/** Parse raw DB value into a typed, defaulted config. */
export function parseConfig(raw: unknown): HospitalConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  const r = raw as Partial<HospitalConfig>
  return {
    hasBranches:    r.hasBranches    ?? DEFAULT_CONFIG.hasBranches,
    hasDepartments: r.hasDepartments ?? DEFAULT_CONFIG.hasDepartments,
    hasUnits:       r.hasUnits       ?? DEFAULT_CONFIG.hasUnits,
    approvalRoles:  Array.isArray(r.approvalRoles) && r.approvalRoles.length > 0
      ? r.approvalRoles as ApprovalRole[]
      : DEFAULT_CONFIG.approvalRoles,
  }
}

// ─── Setup step definitions ───────────────────────────────────────────────────
// Single source of truth used by both the server page (step computation)
// and the client components (wizard, checklist, banner).

export interface SetupStepDef {
  key: string
  icon: string
  label: string
  desc: string
  href: string
  /** When set, this step is only included if config[featureFlag] is true. */
  featureFlag?: keyof Pick<HospitalConfig, 'hasBranches' | 'hasDepartments' | 'hasUnits'>
}

export const ALL_SETUP_STEP_DEFS: SetupStepDef[] = [
  {
    key: 'branch',
    icon: '🏢',
    label: 'Create Branch',
    desc: 'Add your hospital branch or location',
    href: '/hospital/branches',
    featureFlag: 'hasBranches',
  },
  {
    key: 'department',
    icon: '🏬',
    label: 'Create Departments',
    desc: 'Organise departments within the branch',
    href: '/hospital/departments',
    featureFlag: 'hasDepartments',
  },
  {
    key: 'unit',
    icon: '🔲',
    label: 'Create Units',
    desc: 'Add nursing or clinical units',
    href: '/hospital/units',
    featureFlag: 'hasUnits',
  },
  {
    key: 'staff',
    icon: '👥',
    label: 'Add Staff',
    desc: 'Import or create staff accounts',
    href: '/staff-directory',
  },
  {
    key: 'competency',
    icon: '📚',
    label: 'Create Competency Templates',
    desc: 'Define skills staff need to demonstrate',
    href: '/competencies',
  },
]

/** Returns only the steps that are active for a given config. */
export function getActiveSetupSteps(config: HospitalConfig): SetupStepDef[] {
  return ALL_SETUP_STEP_DEFS.filter((s) =>
    !s.featureFlag || config[s.featureFlag] !== false,
  )
}

/**
 * Computes the current setup step index (0-based) given counts.
 * Returns activeSteps.length when all steps are complete.
 *
 * Counts order must match ALL_SETUP_STEP_DEFS key order:
 *   branchCount, deptCount, unitCount, staffCount, compCount
 */
export function computeSetupStep(
  config: HospitalConfig,
  counts: {
    branchCount: number
    deptCount: number
    unitCount: number
    staffCount: number
    compCount: number
  },
): number {
  const countByKey: Record<string, number> = {
    branch:     counts.branchCount,
    department: counts.deptCount,
    unit:       counts.unitCount,
    staff:      counts.staffCount,
    competency: counts.compCount,
  }

  const activeSteps = getActiveSetupSteps(config)
  const firstIncomplete = activeSteps.findIndex((s) => (countByKey[s.key] ?? 0) === 0)
  return firstIncomplete === -1 ? activeSteps.length : firstIncomplete
}
